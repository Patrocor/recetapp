"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { DoctorProfile, PdfConfig } from "@/types";
import { ESPECIALIDADES } from "@/lib/data/especialidades";

const ACCENT_COLORS = [
  { label: "Teal (defecto)", value: "#09707F" },
  { label: "Azul marino",    value: "#1E3A8A" },
  { label: "Violeta",        value: "#6D28D9" },
  { label: "Esmeralda",      value: "#065F46" },
  { label: "Rojo oscuro",    value: "#991B1B" },
  { label: "Índigo",         value: "#3730A3" },
  { label: "Gris antracita", value: "#1F2937" },
  { label: "Marrón",         value: "#78350F" },
];

interface Props {
  profile: DoctorProfile;
  onClose: () => void;
  onSaved: (p: DoctorProfile) => void;
}

export default function ProfileModal({ profile, onClose, onSaved }: Props) {
  const espInicial = ESPECIALIDADES.includes(profile.especialidad) ? profile.especialidad : (profile.especialidad ? "__otra__" : "");
  const [form, setForm] = useState({
    titulo: profile.titulo || "Dr.",
    nombre: profile.nombre || "",
    cmp: profile.cmp || "",
    especialidad: espInicial,
    consultorio: profile.consultorio || "",
    direccion: profile.direccion || "",
    telefono: profile.telefono || "",
    email_contacto: profile.email_contacto || "",
  });
  const [espOtra, setEspOtra] = useState(espInicial === "__otra__" ? profile.especialidad : "");
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig>(profile.pdf_config || {});
  const logoRef = useRef<HTMLInputElement>(null);
  const firmaRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function uploadFile(file: File, bucket: string, path: string): Promise<string | null> {
    const supabase = createClient();
    console.log(`[uploadFile] iniciando → bucket="${bucket}" path="${path}" size=${file.size} type=${file.type}`);
    const { data: uploadData, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      console.error(`[uploadFile] FALLO upload → bucket="${bucket}" path="${path}"`, {
        message: error.message,
        statusCode: (error as unknown as Record<string,unknown>).statusCode,
        error,
      });
      return null;
    }
    console.log(`[uploadFile] upload OK →`, uploadData);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    console.log(`[uploadFile] publicUrl →`, data.publicUrl);
    return data.publicUrl;
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2e6) { alert("Máx. 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleFirmaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1e6) { alert("Máx. 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setFirmaPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSave() {
    if (!form.nombre.trim() || !form.cmp.trim()) {
      alert("Nombre y CMP son obligatorios.");
      return;
    }
    setSaving(true);
    console.log("[handleSave] iniciando guardado de perfil");
    try {
      const supabase = createClient();

      // 1. Verificar sesión
      console.log("[handleSave] 1. obteniendo usuario...");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log("[handleSave] 1. resultado →", { userId: user?.id ?? null, authError });
      if (!user) {
        alert("Sesión expirada. Recarga la página e inicia sesión de nuevo.");
        return;
      }

      const especialidad = form.especialidad === "__otra__" ? espOtra.trim() : form.especialidad;
      const updates: Record<string, unknown> = {
        nombre:         form.nombre,
        cmp:            form.cmp,
        especialidad,
        consultorio:    form.consultorio,
        direccion:      form.direccion,
        telefono:       form.telefono,
        email_contacto: form.email_contacto,
        titulo:         form.titulo,
        pdf_config:     pdfConfig,
      };
      console.log("[handleSave] 2. updates a enviar →", updates);

      // 2. Subir logo si hay nuevo archivo
      if (logoPreview && logoRef.current?.files?.[0]) {
        console.log("[handleSave] 3. subiendo logo...");
        const ext = logoRef.current.files[0].name.split(".").pop() ?? "png";
        const url = await uploadFile(logoRef.current.files[0], "logos", `${user.id}/logo.${ext}`);
        if (!url) {
          alert("Error al subir el logo. Revisa la consola (F12) para ver el error exacto.");
          return;
        }
        updates.logo_url = url;
        console.log("[handleSave] 3. logo_url guardado →", url);
      }

      // 3. Subir firma si hay nuevo archivo
      if (firmaPreview && firmaRef.current?.files?.[0]) {
        console.log("[handleSave] 4. subiendo firma...");
        const url = await uploadFile(firmaRef.current.files[0], "firmas", `${user.id}/firma.png`);
        if (!url) {
          alert("Error al subir la firma. Revisa la consola (F12) para ver el error exacto.");
          return;
        }
        updates.firma_url = url;
        updates.sig_mode  = "rubrica";
        console.log("[handleSave] 4. firma_url guardado →", url);
      }

      // 4. Actualizar profiles
      console.log("[handleSave] 5. ejecutando UPDATE en profiles...");
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      console.log("[handleSave] 5. resultado UPDATE →", { data, updateError });

      if (updateError) {
        console.error("[handleSave] error UPDATE profiles →", updateError);
        alert(`Error al guardar perfil: ${updateError.message}`);
        return;
      }

      if (data) onSaved(data as DoctorProfile);
      console.log("[handleSave] perfil guardado exitosamente");
    } catch (err) {
      console.error("[handleSave] excepción no controlada →", err);
      alert("Error inesperado al guardar. Revisa la consola (F12).");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide mb-1 text-[var(--ink2)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-[var(--card)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--brd)]">
          <h2 className="font-semibold text-[var(--ink)]">Perfil médico</h2>
          <button onClick={onClose} className="text-[var(--ink3)] hover:text-[var(--ink)] text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">

            {/* Título + Nombre */}
            <div className="col-span-2">
              <label className={labelCls}>Nombre completo *</label>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)] shrink-0"
                  value={form.titulo}
                  onChange={(e) => set("titulo", e.target.value)}
                >
                  <option value="Dr.">Dr.</option>
                  <option value="Dra.">Dra.</option>
                </select>
                <input className={inputCls} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>CMP *</label>
              <input className={inputCls} value={form.cmp} onChange={(e) => set("cmp", e.target.value)} />
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
                <input className={inputCls} value={espOtra} onChange={(e) => setEspOtra(e.target.value)} />
              </div>
            )}

            <div className="col-span-2">
              <label className={labelCls}>Consultorio / Institución</label>
              <input className={inputCls} value={form.consultorio} onChange={(e) => set("consultorio", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Dirección</label>
              <input className={inputCls} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input className={inputCls} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Email de contacto</label>
              <input className={inputCls} type="email" value={form.email_contacto} onChange={(e) => set("email_contacto", e.target.value)} />
            </div>
          </div>

          {/* Logo upload */}
          <div>
            <label className={labelCls}>Logo (PNG/JPG, máx. 2 MB)</label>
            {logoPreview || profile.logo_url ? (
              <div className="flex items-center gap-3">
                <img src={logoPreview || profile.logo_url!} alt="logo" className="h-12 object-contain rounded border border-[var(--brd)]" />
                <button type="button" className="text-xs text-red-500 underline" onClick={() => { setLogoPreview(null); if(logoRef.current) logoRef.current.value=""; }}>Quitar</button>
                <button type="button" className="text-xs underline text-[var(--ink3)]" onClick={() => logoRef.current?.click()}>Cambiar</button>
              </div>
            ) : (
              <button type="button" className="text-sm text-[var(--c7)] underline" onClick={() => logoRef.current?.click()}>
                + Cargar logo
              </button>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>

          {/* Firma upload */}
          <div>
            <label className={labelCls}>Firma / Rúbrica (PNG transparente, máx. 1 MB)</label>
            {firmaPreview || profile.firma_url ? (
              <div className="flex items-center gap-3">
                <img src={firmaPreview || profile.firma_url!} alt="firma" className="h-12 object-contain rounded border border-[var(--brd)] bg-gray-50" />
                <button type="button" className="text-xs text-red-500 underline" onClick={() => { setFirmaPreview(null); if(firmaRef.current) firmaRef.current.value=""; }}>Quitar</button>
                <button type="button" className="text-xs underline text-[var(--ink3)]" onClick={() => firmaRef.current?.click()}>Cambiar</button>
              </div>
            ) : (
              <button type="button" className="text-sm text-[var(--c7)] underline" onClick={() => firmaRef.current?.click()}>
                + Cargar firma
              </button>
            )}
            <input ref={firmaRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFirmaChange} />
          </div>

          {/* PDF customisation */}
          <div className="pt-2 border-t border-[var(--brd)] space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink2)]">Personalización de PDFs</p>

            <div>
              <p className="text-xs text-[var(--ink3)] mb-2">Color de acento</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((c) => {
                  const active = (pdfConfig.accentColor || "#09707F") === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setPdfConfig((p) => ({ ...p, accentColor: c.value }))}
                      className={`w-7 h-7 rounded-full border-2 transition ${active ? "border-[var(--ink)] scale-110" : "border-transparent opacity-70 hover:opacity-100"}`}
                      style={{ background: c.value }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelCls}>Tipografía del cuerpo</label>
              <select
                className={inputCls}
                value={pdfConfig.fontFamily || "helvetica"}
                onChange={(e) => setPdfConfig((p) => ({ ...p, fontFamily: e.target.value as PdfConfig["fontFamily"] }))}
              >
                <option value="helvetica">Helvetica (moderna, por defecto)</option>
                <option value="times">Times New Roman (clásica)</option>
                <option value="courier">Courier (monoespaciada)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Estilo de encabezado</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPdfConfig((p) => ({ ...p, headerStyle: "standard" }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${(pdfConfig.headerStyle || "standard") === "standard" ? "bg-teal-700 text-white border-teal-700" : "border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)]"}`}
                >
                  Estándar (con dirección y teléfono)
                </button>
                <button
                  type="button"
                  onClick={() => setPdfConfig((p) => ({ ...p, headerStyle: "minimal" }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${pdfConfig.headerStyle === "minimal" ? "bg-teal-700 text-white border-teal-700" : "border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)]"}`}
                >
                  Minimalista (solo nombre y CMP)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--brd)]">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50 transition"
            style={{ background: "#09707F" }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
