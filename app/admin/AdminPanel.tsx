"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserAccess, AdminLogEntry } from "@/types";
import { getExpDisplay, isValidAccess } from "@/lib/utils";
import {
  createUser, toggleUserActive, renewUser,
  deleteUser, clearAdminLog,
} from "./actions";

interface Props {
  users: UserAccess[];
  docCountMap: Record<string, number>;
  log: AdminLogEntry[];
  adminUsername: string;
}

function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789@#$";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd.charAt(0).toUpperCase() + pwd.slice(1);
}

export default function AdminPanel({ users, docCountMap, log, adminUsername }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"users" | "log">("users");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", password: genPassword(), nombre: "", contact: "", expDays: "30" });
  const [createResult, setCreateResult] = useState<{ credentials?: { username: string; password: string; expLabel: string } } | null>(null);
  const [formError, setFormError] = useState("");

  const now = Date.now();
  const activos = users.filter((u) => isValidAccess(u)).length;
  const suspendidos = users.filter((u) => !u.active).length;
  const expiran7 = users.filter((u) => u.exp_at && new Date(u.exp_at).getTime() > now && new Date(u.exp_at).getTime() - now < 7 * 86400000).length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    const result = await createUser(fd);
    if ("error" in result) { setFormError(result.error ?? "Error desconocido"); return; }
    setCreateResult(result);
    setForm({ username: "", password: genPassword(), nombre: "", contact: "", expDays: "30" });
    router.refresh();
  }

  function copyCredentials() {
    if (!createResult?.credentials) return;
    const c = createResult.credentials;
    const msg = `🩺 *RecetAPP — Acceso médico*\n\nHola${c.username ? " " + c.username.split("@")[0] : ""},\n\nTe comparto tus credenciales de acceso a RecetAPP.\n\n👤 *Usuario:* ${c.username}\n🔑 *Contraseña:* ${c.password}\n📅 *Válido hasta:* ${c.expLabel}\n\n_RecetAPP · Documentos Médicos Digitales · Perú_`;
    navigator.clipboard.writeText(msg);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide mb-1 text-[var(--ink2)]";

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--brd)] bg-[var(--card)] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#04313A,#0E9BB0)" }}>
              <svg width="18" height="18" viewBox="0 0 36 36" fill="none"><path d="M18 6v24M6 18h24" stroke="white" strokeWidth="4" strokeLinecap="round"/></svg>
            </div>
            <span className="font-semibold text-[var(--ink)]">Panel de Administrador</span>
          </div>
          <Link href="/receta" className="text-xs px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition">
            ← Volver
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-20">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Activos", value: activos, color: "text-emerald-700" },
            { label: "Suspendidos", value: suspendidos, color: "text-red-600" },
            { label: "Expiran en 7d", value: expiran7, color: "text-amber-600" },
            { label: "Total usuarios", value: users.length, color: "text-[var(--c7)]" },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[var(--ink3)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--brd)]">
          {(["users", "log"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === t ? "border-teal-700 text-teal-800" : "border-transparent text-[var(--ink3)] hover:text-[var(--ink2)]"}`}>
              {t === "users" ? "Usuarios" : "Registro de actividad"}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="space-y-4">
            {/* Create user button */}
            <div className="flex justify-end">
              <button onClick={() => { setShowCreate((v) => !v); setCreateResult(null); setFormError(""); }}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: "#09707F" }}>
                {showCreate ? "Cancelar" : "+ Nuevo acceso"}
              </button>
            </div>

            {/* Create form */}
            {showCreate && (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
                {createResult?.credentials ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-emerald-700">✓ Acceso creado correctamente</p>
                    <div className="bg-[var(--bg)] rounded-lg p-4 text-sm space-y-1 font-mono border border-[var(--brd)]">
                      <p><span className="font-sans text-[var(--ink3)] text-xs uppercase tracking-wide">Usuario</span><br /><strong>{createResult.credentials.username}</strong></p>
                      <p><span className="font-sans text-[var(--ink3)] text-xs uppercase tracking-wide">Contraseña</span><br /><strong>{createResult.credentials.password}</strong></p>
                      <p><span className="font-sans text-[var(--ink3)] text-xs uppercase tracking-wide">Válido hasta</span><br /><strong>{createResult.credentials.expLabel}</strong></p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={copyCredentials} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: "#09707F" }}>
                        Copiar mensaje WhatsApp
                      </button>
                      <button onClick={() => { setCreateResult(null); setShowCreate(false); }} className="px-4 py-2 rounded-lg border border-[var(--brd)] text-sm text-[var(--ink2)] hover:bg-[var(--bg2)]">
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreate} className="space-y-4">
                    <h3 className="text-sm font-semibold">Crear nuevo acceso médico</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Usuario *</label>
                        <input className={inputCls} placeholder="drjuan" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} />
                      </div>
                      <div>
                        <label className={labelCls}>Contraseña *</label>
                        <div className="flex gap-2">
                          <input className={inputCls} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                          <button type="button" onClick={() => setForm((f) => ({ ...f, password: genPassword() }))}
                            className="px-3 py-2 rounded-lg border border-[var(--brd)] text-xs text-[var(--ink2)] hover:bg-[var(--bg2)] shrink-0">
                            Generar
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Nombre completo</label>
                        <input className={inputCls} placeholder="Dr. Juan Pérez" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                      </div>
                      <div>
                        <label className={labelCls}>Contacto (WhatsApp)</label>
                        <input className={inputCls} placeholder="+51 999 888 777" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Vigencia</label>
                        <div className="flex gap-2 flex-wrap">
                          {[["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["365", "1 año"], ["0", "Sin vencimiento"]].map(([v, l]) => (
                            <button key={v} type="button"
                              onClick={() => setForm((f) => ({ ...f, expDays: v }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${form.expDays === v ? "bg-teal-800 text-white border-teal-800" : "border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)]"}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {formError && <p className="text-sm text-red-600">{formError}</p>}
                    <button type="submit" disabled={isPending}
                      className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: "#09707F" }}>
                      {isPending ? "Creando…" : "Crear acceso"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* User table */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] overflow-hidden">
              {users.length === 0 ? (
                <div className="text-center py-12 text-[var(--ink3)]">Sin usuarios registrados</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--brd)] bg-[var(--bg)]">
                        <th className="text-left px-4 py-3 text-xs font-bold text-[var(--ink3)] uppercase tracking-wide">Usuario</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-[var(--ink3)] uppercase tracking-wide hidden sm:table-cell">Estado</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-[var(--ink3)] uppercase tracking-wide hidden sm:table-cell">Vencimiento</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-[var(--ink3)] uppercase tracking-wide">Docs</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]">
                      {users.map((u) => {
                        const valid = isValidAccess(u);
                        const exp = getExpDisplay(u.exp_at);
                        const status = valid ? "Activo" : !u.active ? "Suspendido" : "Expirado";
                        const statusCls = valid ? "text-emerald-700 bg-emerald-50" : !u.active ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50";
                        const docs = docCountMap[u.id] || 0;
                        return (
                          <tr key={u.id} className="hover:bg-[var(--bg)]">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[var(--ink)]">{u.nombre || u.username}</p>
                              <p className="text-xs text-[var(--ink3)]">@{u.username}</p>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{status}</span>
                            </td>
                            <td className={`px-4 py-3 text-xs hidden sm:table-cell ${exp.cls}`}>{exp.label}</td>
                            <td className="px-4 py-3 text-center text-sm font-semibold">{docs}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={() => startTransition(() => toggleUserActive(u.id, u.active).then(() => router.refresh()))}
                                  className="text-xs px-2 py-1 rounded border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition"
                                  title={u.active ? "Suspender" : "Reactivar"}
                                >
                                  {u.active ? "⏸" : "▶"}
                                </button>
                                <button
                                  onClick={async () => {
                                    const dias = parseInt(prompt("¿Cuántos días agregar al acceso?", "30") || "");
                                    if (isNaN(dias) || dias <= 0) return;
                                    startTransition(() => renewUser(u.id, dias).then(() => router.refresh()));
                                  }}
                                  className="text-xs px-2 py-1 rounded border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition"
                                >
                                  +días
                                </button>
                                <button
                                  onClick={() => {
                                    if (!confirm(`¿Eliminar permanentemente el acceso de "${u.username}"?`)) return;
                                    startTransition(() => deleteUser(u.id).then(() => router.refresh()));
                                  }}
                                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition"
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "log" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => { if (confirm("¿Limpiar el registro de actividad?")) startTransition(() => clearAdminLog().then(() => router.refresh())); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition"
              >
                Limpiar log
              </button>
            </div>

            {log.length === 0 ? (
              <div className="text-center py-12 text-[var(--ink3)]">Sin actividad registrada aún</div>
            ) : (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] divide-y divide-[var(--brd)]">
                {log.map((entry) => {
                  const date = new Date(entry.created_at).toLocaleString("es-PE", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0 w-2 h-2 rounded-full bg-teal-500" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-[var(--ink)]">@{entry.actor}</span>
                        <span className="text-xs text-[var(--ink3)]"> → {entry.descripcion}</span>
                        {entry.target && entry.target !== entry.actor && (
                          <span className="text-xs text-[var(--ink3)]"> ({entry.target})</span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--ink3)] shrink-0">{date}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
