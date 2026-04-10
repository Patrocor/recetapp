"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ESPECIALIDADES } from "@/lib/data/especialidades";

export default function SetupPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    titulo: "Dr.",
    nombre: "", cmp: "", especialidad: "",
    consultorio: "", direccion: "", telefono: "", email_contacto: "",
  });
  const [espOtra, setEspOtra] = useState("");
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null);
  const [omitirFirma, setOmitirFirma] = useState(false);
  const firmaRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleFirmaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1e6) { setError("La imagen de firma debe pesar menos de 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setFirmaPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    setOmitirFirma(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    if (!form.cmp.trim()) { setError("El CMP es obligatorio."); return; }

    setSaving(true);

    console.log("[Setup] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[Setup] NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ presente" : "✗ falta");

    const supabase = createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      setError("Sesión expirada. Vuelve a iniciar sesión.");
      setSaving(false);
      router.push("/login");
      return;
    }

    console.log("[Setup] user.id:", user.id, "email:", user.email);

    const username = user.email?.split("@")[0] ?? "";
    const especialidad = form.especialidad === "__otra__" ? espOtra.trim() : form.especialidad;
    const sigMode = (firmaPreview && !omitirFirma) ? "rubrica" : "digital";

    const updates: Record<string, unknown> = {
      id: user.id,
      username,
      titulo: form.titulo,
      nombre: form.nombre.trim(),
      cmp: form.cmp.trim(),
      especialidad,
      consultorio: form.consultorio.trim(),
      direccion: form.direccion.trim(),
      telefono: form.telefono.trim(),
      email_contacto: form.email_contacto.trim(),
      sig_mode: sigMode,
    };

    // Upload firma if provided
    if (firmaPreview && !omitirFirma && firmaRef.current?.files?.[0]) {
      const file = firmaRef.current.files[0];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/firma.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("firmas")
        .upload(path, file, { upsert: true });
      if (upErr) {
        console.warn("[Setup] firma upload error:", upErr.message, "— continuando sin firma");
      } else {
        const { data: urlData } = supabase.storage.from("firmas").getPublicUrl(path);
        updates.firma_url = urlData.publicUrl;
      }
    }

    const { error: upsertErr } = await supabase.from("profiles").upsert(updates);

    if (upsertErr) {
      console.error("[Setup] upsert error:", upsertErr);
      setError(`Error al guardar: ${upsertErr.message}`);
      setSaving(false);
      return;
    }

    console.log("[Setup] perfil guardado correctamente, redirigiendo…");
    router.push("/receta");
  }

  const inputCls = "w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide mb-1 text-[var(--ink2)]";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
      <div className="w-full max-w-lg bg-[var(--card)] rounded-2xl shadow-xl p-8 border border-[var(--brd)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#04313A,#0E9BB0)" }}>
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
              <path d="M18 6v24M6 18h24" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="font-serif text-xl font-normal text-[var(--c9)]">Configura tu perfil</h1>
            <p className="text-xs text-[var(--ink3)]">Aparecerá en todos tus documentos PDF</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Título + Nombre */}
            <div className="col-span-2">
              <label className={labelCls}>Nombre completo <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)] shrink-0"
                  value={form.titulo}
                  onChange={(e) => set("titulo", e.target.value)}
                >
                  <option value="Dr.">Dr.</option>
                  <option value="Dra.">Dra.</option>
                </select>
                <input className={inputCls} placeholder="Juan Pérez García"
                  value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>CMP <span className="text-red-500">*</span></label>
              <input className={inputCls} placeholder="12345"
                value={form.cmp} onChange={(e) => set("cmp", e.target.value)} />
            </div>

            {/* Especialidad dropdown */}
            <div>
              <label className={labelCls}>Especialidad</label>
              <select className={inputCls} value={form.especialidad} onChange={(e) => set("especialidad", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
                <option value="__otra__">Otra…</option>
              </select>
            </div>

            {form.especialidad === "__otra__" && (
              <div className="col-span-2">
                <label className={labelCls}>Escribe tu especialidad</label>
                <input className={inputCls} placeholder="Ej: Medicina del Deporte"
                  value={espOtra} onChange={(e) => setEspOtra(e.target.value)} />
              </div>
            )}

            <div className="col-span-2">
              <label className={labelCls}>Nombre del consultorio</label>
              <input className={inputCls} placeholder="Clínica / Consultorio / Hospital"
                value={form.consultorio} onChange={(e) => set("consultorio", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Dirección</label>
              <input className={inputCls} placeholder="Av. Javier Prado 123, San Isidro, Lima"
                value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input className={inputCls} placeholder="(01) 234-5678"
                value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Email de contacto</label>
              <input className={inputCls} type="email" placeholder="correo@hospital.pe"
                value={form.email_contacto} onChange={(e) => set("email_contacto", e.target.value)} />
            </div>
          </div>

          {/* Firma upload */}
          <div className="border border-[var(--brd)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">Firma / Rúbrica</p>
                <p className="text-xs text-[var(--ink3)]">PNG transparente — aparecerá sobre la línea de firma en los PDFs</p>
              </div>
            </div>

            {firmaPreview && !omitirFirma ? (
              <div className="flex items-center gap-3">
                <img src={firmaPreview} alt="firma" className="h-14 object-contain rounded border border-[var(--brd)] bg-gray-50 px-2" />
                <div className="flex flex-col gap-1">
                  <button type="button" className="text-xs underline text-[var(--ink3)]" onClick={() => firmaRef.current?.click()}>Cambiar</button>
                  <button type="button" className="text-xs text-red-500 underline" onClick={() => { setFirmaPreview(null); if (firmaRef.current) firmaRef.current.value = ""; }}>Quitar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => { setOmitirFirma(false); firmaRef.current?.click(); }}
                  className="w-full py-2 rounded-lg border-2 border-dashed border-[var(--brd)] text-sm text-[var(--ink2)] hover:border-teal-400 hover:text-teal-700 transition"
                >
                  + Cargar imagen de firma (PNG, máx. 1 MB)
                </button>
                {!omitirFirma && (
                  <button
                    type="button"
                    onClick={() => setOmitirFirma(true)}
                    className="text-xs text-[var(--ink3)] underline text-center"
                  >
                    Omitir — usar firma digital por defecto
                  </button>
                )}
                {omitirFirma && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-teal-50 border border-teal-200">
                    <span className="text-xs text-teal-700">Se usará firma digital automática en los PDFs.</span>
                    <button type="button" onClick={() => setOmitirFirma(false)} className="text-xs text-teal-600 underline ml-auto">Cambiar</button>
                  </div>
                )}
              </div>
            )}
            <input ref={firmaRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFirmaChange} />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-lg text-white font-semibold text-[15px] mt-2 disabled:opacity-50"
            style={{ background: "#09707F" }}
          >
            {saving ? "Guardando…" : "Guardar y continuar →"}
          </button>
        </form>
      </div>
    </div>
  );
}
