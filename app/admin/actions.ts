"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/utils";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) throw new Error("Acceso denegado");
  return user;
}

async function getAdminUsername(userId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("username").eq("id", userId).single();
  return data?.username || "admin";
}

async function writeLog(tipo: string, actor: string, target: string, descripcion: string) {
  const supabase = createClient();
  await supabase.from("admin_log").insert({ tipo, actor, target, descripcion });
}

// ── CREATE USER ──────────────────────────────────────────────
export async function createUser(formData: FormData) {
  const adminUser = await requireAdmin();
  const adminName = await getAdminUsername(adminUser.id);

  const username = String(formData.get("username") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "").trim();
  const nombre   = String(formData.get("nombre") || "").trim();
  const contact  = String(formData.get("contact") || "").trim();
  const expDays  = parseInt(String(formData.get("expDays") || "30"));

  if (!username) return { error: "El usuario es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };
  if (username.length < 3) return { error: "El usuario debe tener al menos 3 caracteres." };

  const email = usernameToEmail(username);
  const expAt = expDays > 0
    ? new Date(Date.now() + expDays * 86400000).toISOString()
    : null;

  const adminClient = createAdminClient();

  // Check username not taken
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("user_access")
    .select("id")
    .eq("username", username)
    .single();
  if (existing) return { error: "Ese nombre de usuario ya existe." };

  // Create auth user
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (authErr) return { error: "Error al crear usuario: " + authErr.message };

  const userId = authData.user.id;

  // Insert user_access and profiles
  await supabase.from("user_access").insert({
    id: userId, username, nombre: nombre || username,
    contact, exp_at: expAt, active: true,
    created_by: adminName,
  });

  await supabase.from("profiles").upsert({
    id: userId, username, nombre: nombre || username,
    is_admin: false,
  });

  await writeLog("create", adminName, username,
    `Acceso creado (${expDays > 0 ? expDays + " días" : "sin vencimiento"})`);

  revalidatePath("/admin");
  return {
    ok: true,
    credentials: {
      username,
      password,
      expLabel: expAt
        ? new Date(expAt).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })
        : "Sin vencimiento",
    },
  };
}

// ── SUSPEND / REACTIVATE ─────────────────────────────────────
export async function toggleUserActive(userId: string, currentActive: boolean) {
  const adminUser = await requireAdmin();
  const adminName = await getAdminUsername(adminUser.id);
  const supabase = createClient();

  const { data: ua } = await supabase
    .from("user_access")
    .select("username")
    .eq("id", userId)
    .single();

  await supabase
    .from("user_access")
    .update({ active: !currentActive })
    .eq("id", userId);

  const accion = !currentActive ? "Acceso reactivado" : "Acceso suspendido";
  await writeLog("suspend", adminName, ua?.username || userId, accion);
  revalidatePath("/admin");
}

// ── RENEW ACCESS ─────────────────────────────────────────────
export async function renewUser(userId: string, dias: number) {
  const adminUser = await requireAdmin();
  const adminName = await getAdminUsername(adminUser.id);
  const supabase = createClient();

  const { data: ua } = await supabase
    .from("user_access")
    .select("username, exp_at")
    .eq("id", userId)
    .single();

  const base = ua?.exp_at && new Date(ua.exp_at).getTime() > Date.now()
    ? new Date(ua.exp_at).getTime()
    : Date.now();
  const newExp = new Date(base + dias * 86400000).toISOString();

  await supabase.from("user_access").update({ exp_at: newExp, active: true }).eq("id", userId);
  await writeLog("renew", adminName, ua?.username || userId, `Renovado +${dias} días`);
  revalidatePath("/admin");
}

// ── DELETE USER ──────────────────────────────────────────────
export async function deleteUser(userId: string) {
  const adminUser = await requireAdmin();
  const adminName = await getAdminUsername(adminUser.id);
  const supabase = createClient();

  const { data: ua } = await supabase
    .from("user_access")
    .select("username")
    .eq("id", userId)
    .single();

  const adminClient = createAdminClient();
  await adminClient.auth.admin.deleteUser(userId);

  await writeLog("delete", adminName, ua?.username || userId, "Acceso eliminado");
  revalidatePath("/admin");
}

// ── CLEAR LOG ────────────────────────────────────────────────
export async function clearAdminLog() {
  await requireAdmin();
  const supabase = createClient();
  await supabase.from("admin_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  revalidatePath("/admin");
}
