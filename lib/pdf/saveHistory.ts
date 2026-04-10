import { createClient } from "@/lib/supabase/client";

export async function saveHistory(
  tipo: "receta" | "orden" | "const" | "cert",
  folio: string,
  paciente: string,
  fecha: string,
  diagnostico: string,
  metadata: Record<string, unknown>
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("documents").insert({
    user_id: user.id,
    tipo,
    folio,
    paciente,
    fecha,
    diagnostico,
    metadata,
  });
}
