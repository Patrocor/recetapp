"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import DxSearch from "@/components/ui/DxSearch";
import { DoctorProfile } from "@/types";
import { formatDateLong } from "@/lib/utils";
import { buildCertificado } from "@/lib/pdf/builders";
import { loadProfileImages } from "@/lib/pdf/loadImage";
import { saveHistory } from "@/lib/pdf/saveHistory";
import { generateFolio } from "@/lib/pdf/folio";

const LAST_PAT_KEY = "recetapp_lastpat";
function todayISO() { return new Date().toISOString().split("T")[0]; }

export default function CertificadoPage() {
  return <ToastProvider><CertificadoForm /></ToastProvider>;
}

function CertificadoForm() {
  const toast = useToast();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [pat, setPat] = useState({ nombre: "", dni: "", edad: "", sexo: "" });
  const [fecha, setFecha] = useState(todayISO());
  const [dx, setDx] = useState("");
  const [diasReposo, setDiasReposo] = useState(0);
  const [fechaIni, setFechaIni] = useState(todayISO());
  const [fechaFin, setFechaFin] = useState("");
  const [textoNormativo, setTextoNormativo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sigMode, setSigMode] = useState<"rubrica" | "digital">("rubrica");
  const [hasPrevPat, setHasPrevPat] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("*").eq("id", user.id).single()
        .then(({ data }) => {
          if (data) {
            setProfile(data as DoctorProfile);
            setSigMode((data as DoctorProfile).sig_mode || "rubrica");
          }
        });
    });
    setHasPrevPat(!!localStorage.getItem(LAST_PAT_KEY));
  }, []);

  useEffect(() => {
    if (!fechaIni || !diasReposo) { setFechaFin(""); return; }
    const dt = new Date(fechaIni + "T00:00:00");
    dt.setDate(dt.getDate() + diasReposo - 1);
    setFechaFin(dt.toISOString().split("T")[0]);
  }, [fechaIni, diasReposo]);

  function setP(k: string, v: string) { setPat((f) => ({ ...f, [k]: v })); }

  function usarPacienteAnterior() {
    const raw = localStorage.getItem(LAST_PAT_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      setPat((f) => ({ ...f, nombre: saved.nombre, dni: saved.dni, edad: saved.edad, sexo: saved.sexo }));
      toast("Datos del paciente anterior cargados", "ok");
    } catch { /* ignore */ }
  }

  function fmtLong(iso: string) {
    if (!iso) return "—";
    return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
      day: "numeric", month: "long", year: "numeric",
    });
  }

  function generarTexto() {
    if (!profile?.nombre || !profile?.cmp) { toast("Completa tu perfil primero."); return; }
    if (!pat.nombre || !pat.dni) { toast("Completa nombre y DNI del paciente."); return; }
    if (!dx) { toast("Agrega el diagnóstico CIE-10."); return; }
    if (diasReposo > 0 && !fechaIni) { toast("Indica la fecha de inicio del reposo."); return; }

    const esDra = profile.titulo === "Dra.";
    const suscrito = esDra ? "La que suscribe" : "El que suscribe";
    const cleanNombre = profile.nombre.replace(/^(Dr\.|Dra\.)\s+/i, "");
    const titulo = profile.titulo || "Dr.";

    // "I10 — Hipertensión esencial" → code="I10", name="Hipertensión esencial"
    const parts = dx.split(" — ");
    const cie10code = parts[0]?.trim() || "";
    const dxNombre = parts.slice(1).join(" — ").trim() || dx;

    const edadStr = pat.edad ? `de ${pat.edad} años, ` : "";

    let descansoFrase = "";
    if (diasReposo > 0 && fechaIni) {
      const ini = fmtLong(fechaIni);
      const fin = fmtLong(fechaFin || fechaIni);
      const d = diasReposo === 1 ? "1 día" : `${diasReposo} días`;
      descansoFrase = `, por lo que se prescribe ${d} de descanso médico, desde el ${ini} hasta el ${fin}`;
    }

    const city = profile.direccion
      ? profile.direccion.split(",").pop()!.trim()
      : "Trujillo";

    const txt =
      `${suscrito} ${titulo} ${cleanNombre}, CMP ${profile.cmp}, ` +
      `CERTIFICA que atendió al/la paciente ${pat.nombre}, ` +
      `${edadStr}DNI ${pat.dni}, quien presenta sintomatología compatible con ` +
      `${dxNombre}, CIE-10: ${cie10code}${descansoFrase}.\n\n` +
      `${city}, ${fmtLong(fecha)}.`;

    setTextoNormativo(txt);
    toast("Texto generado ✓", "ok");
  }

  async function generate(preview = false) {
    if (!profile?.nombre || !profile?.cmp) { toast("Perfil incompleto."); return; }
    if (!pat.nombre.trim() || !pat.dni.trim()) { toast("Nombre y DNI son obligatorios."); return; }
    if (!dx.trim()) { toast("El diagnóstico es obligatorio."); return; }
    if (!textoNormativo.trim()) { toast("Genera el texto del certificado primero."); return; }

    setGenerating(true);
    try {
      const effectiveSigMode = sigMode === "rubrica" && !profile.firma_url ? "digital" : sigMode;
      const { firmaDataUrl, logoDataUrl } = await loadProfileImages(
        effectiveSigMode === "rubrica" ? profile.firma_url : null,
        profile.logo_url,
      );

      const folio = await generateFolio(pat.nombre, "Cer");
      const { doc, filename } = buildCertificado({
        medico: {
          titulo: profile.titulo || "Dr.",
          nombre: profile.nombre, cmp: profile.cmp, esp: profile.especialidad || "",
          consult: profile.consultorio || "", dir: profile.direccion || "",
          tel: profile.telefono || "", email: profile.email_contacto || "",
          logoDataUrl, firmaDataUrl,
          firmaSize: profile.firma_size || 90, sigMode: effectiveSigMode,
          config: profile.pdf_config,
        },
        folio,
        paciente: pat, fecha, diagnostico: dx,
        diasReposo, fechaIni, fechaFin,
        textoNormativo,
      });

      if (preview) window.open(doc.output("bloburl"), "_blank");
      else { doc.save(filename); toast("Certificado descargado ✓", "ok"); }

      localStorage.setItem(LAST_PAT_KEY, JSON.stringify(pat));
      await saveHistory("cert", folio, pat.nombre, formatDateLong(fecha), dx, { diasReposo });
    } catch (e: any) {
      toast("Error: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide mb-1 text-[var(--ink2)]";

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h2 className="font-semibold text-[var(--ink)]">Certificado Médico</h2>
      </div>

      {/* Datos del paciente */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Datos del paciente</h3>
          {hasPrevPat && (
            <button onClick={usarPacienteAnterior}
              className="text-xs px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 transition">
              Usar paciente anterior
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Nombre completo *</label>
            <input className={inputCls} value={pat.nombre} onChange={(e) => setP("nombre", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>DNI *</label>
            <input className={inputCls} value={pat.dni} onChange={(e) => setP("dni", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Edad</label>
            <input className={inputCls} placeholder="Ej: 35" value={pat.edad} onChange={(e) => setP("edad", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Sexo</label>
            <select className={inputCls} value={pat.sexo} onChange={(e) => setP("sexo", e.target.value)}>
              <option value="">—</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Fecha de atención</label>
            <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Diagnóstico y reposo */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold">Diagnóstico y descanso médico</h3>
        <div>
          <label className={labelCls}>Diagnóstico CIE-10 *</label>
          <DxSearch value={dx} onChange={setDx} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Días de reposo</label>
            <input
              type="number" min={0}
              className={inputCls}
              value={diasReposo || ""}
              onChange={(e) => setDiasReposo(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha inicio</label>
            <input type="date" className={inputCls} value={fechaIni} onChange={(e) => setFechaIni(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fecha fin (auto)</label>
            <input type="date" className={inputCls + " opacity-60"} value={fechaFin} readOnly />
          </div>
        </div>
      </section>

      {/* Texto del certificado */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Texto del certificado</h3>
          <button
            onClick={generarTexto}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition"
            style={{ background: "#09707F" }}
          >
            Generar texto
          </button>
        </div>
        <textarea
          className={inputCls + " h-44 resize-none font-mono text-[13px]"}
          placeholder={"Completa los campos y haz clic en «Generar texto»,\no escribe el texto directamente aquí…"}
          value={textoNormativo}
          onChange={(e) => setTextoNormativo(e.target.value)}
        />
        <p className="text-[11px] text-[var(--ink3)]">
          El texto se imprimirá tal como aparece arriba seguido de «Atentamente,» y la firma del médico.
        </p>
      </section>

      {/* Modo de firma */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold">Modo de firma en el PDF</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSigMode("rubrica")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${sigMode === "rubrica" ? "bg-teal-700 text-white border-teal-700" : "border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)]"}`}
          >
            Firma con rúbrica (PNG)
          </button>
          <button
            onClick={() => setSigMode("digital")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${sigMode === "digital" ? "bg-teal-700 text-white border-teal-700" : "border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)]"}`}
          >
            Firma digital
          </button>
        </div>
        {sigMode === "rubrica" && !profile?.firma_url && (
          <p className="text-xs text-amber-600">No hay imagen de firma cargada — se usará firma digital automáticamente.</p>
        )}
      </section>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => generate(true)}
          disabled={generating}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition disabled:opacity-50"
        >
          Vista previa
        </button>
        <button
          onClick={() => generate(false)}
          disabled={generating}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition"
          style={{ background: "#09707F" }}
        >
          {generating ? "Generando…" : "Descargar PDF ↓"}
        </button>
      </div>
    </div>
  );
}
