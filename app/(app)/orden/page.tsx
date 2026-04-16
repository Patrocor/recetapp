"use client";

import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import DxSearch from "@/components/ui/DxSearch";
import ExamSearch from "@/components/ui/ExamSearch";
import { ExamItem } from "@/types";
import { useProfile } from "@/lib/context/profile";
import { formatDateLong } from "@/lib/utils";
import { buildOrden } from "@/lib/pdf/builders";
import { loadProfileImages } from "@/lib/pdf/loadImage";
import { saveHistory } from "@/lib/pdf/saveHistory";
import { generateFolio } from "@/lib/pdf/folio";

const LAST_PAT_KEY = "recetapp_lastpat";
function todayISO() { return new Date().toISOString().split("T")[0]; }

export default function OrdenPage() {
  return <ToastProvider><OrdenForm /></ToastProvider>;
}

function OrdenForm() {
  const toast = useToast();
  const { profile } = useProfile();
  const [pat, setPat] = useState({ nombre: "", dni: "", edad: "", sexo: "", fecha: todayISO() });
  const [dx, setDx] = useState("");
  const [indicacion, setIndicacion] = useState("");
  const [urgencia, setUrgencia] = useState("");
  const [examenes, setExamenes] = useState<ExamItem[]>([]);
  const [newExam, setNewExam] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sigMode, setSigMode] = useState<"rubrica" | "digital">(profile.sig_mode || "rubrica");
  const [hasPrevPat, setHasPrevPat] = useState(false);

  useEffect(() => {
    setHasPrevPat(!!localStorage.getItem(LAST_PAT_KEY));
  }, []);

  function setP(k: string, v: string) { setPat((f) => ({ ...f, [k]: v })); }

  function usarPacienteAnterior() {
    const raw = localStorage.getItem(LAST_PAT_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      setPat((f) => ({ ...f, nombre: saved.nombre, dni: saved.dni, edad: saved.edad, sexo: saved.sexo }));
      toast("Datos del paciente anterior cargados", "ok");
    } catch {}
  }

  function addExam(name: string) {
    if (!name.trim()) { toast("Escribe el nombre del examen."); return; }
    setExamenes((e) => [...e, { id: Date.now(), n: name.trim() }]);
    setNewExam("");
    toast("Examen agregado", "ok");
  }

  async function generate(preview = false) {
    if (!profile?.nombre || !profile?.cmp) { toast("Perfil incompleto. Abre el Perfil."); return; }
    if (!pat.nombre.trim() || !pat.edad.trim()) { toast("Completa nombre y edad."); return; }
    if (!examenes.length) { toast("Agrega al menos un examen."); return; }

    setGenerating(true);
    try {
      const effectiveSigMode = sigMode === "rubrica" && !profile.firma_url ? "digital" : sigMode;
      const { firmaDataUrl, logoDataUrl } = await loadProfileImages(
        effectiveSigMode === "rubrica" ? profile.firma_url : null,
        profile.logo_url,
      );

      const folio = await generateFolio(pat.nombre, "O");
      const { doc, filename } = buildOrden({
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
        paciente: pat, diagnostico: dx, indicacionClinica: indicacion,
        urgencia, examenes,
      });

      if (preview) window.open(doc.output("bloburl"), "_blank");
      else { doc.save(filename); toast("Orden descargada ✓", "ok"); }

      await saveHistory("orden", folio, pat.nombre, formatDateLong(pat.fecha), dx, { examenes: examenes.length });
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
      <h2 className="font-semibold text-[var(--ink)]">🧪 Orden de Exámenes Auxiliares</h2>

      {/* Paciente */}
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
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={pat.nombre} onChange={(e) => setP("nombre", e.target.value)} />
          </div>
          <div><label className={labelCls}>DNI</label><input className={inputCls} value={pat.dni} onChange={(e) => setP("dni", e.target.value)} /></div>
          <div><label className={labelCls}>Edad *</label><input className={inputCls} value={pat.edad} onChange={(e) => setP("edad", e.target.value)} /></div>
          <div>
            <label className={labelCls}>Sexo</label>
            <select className={inputCls} value={pat.sexo} onChange={(e) => setP("sexo", e.target.value)}>
              <option value="">—</option><option value="M">Masculino</option><option value="F">Femenino</option>
            </select>
          </div>
          <div><label className={labelCls}>Fecha *</label><input type="date" className={inputCls} value={pat.fecha} onChange={(e) => setP("fecha", e.target.value)} /></div>
        </div>
      </section>

      {/* Diagnóstico + urgencia */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold">Diagnóstico e indicación</h3>
        <div>
          <label className={labelCls}>Diagnóstico presuntivo (CIE-10)</label>
          <DxSearch value={dx} onChange={setDx} placeholder="Opcional — busca por nombre o código…" />
        </div>
        <div>
          <label className={labelCls}>Indicación clínica</label>
          <input className={inputCls} placeholder="Motivo de los exámenes…" value={indicacion} onChange={(e) => setIndicacion(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Urgencia</label>
          <select className={inputCls} value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
            <option value="">Sin carácter de urgencia</option>
            <option value="Urgente">Urgente</option>
            <option value="Muy urgente">Muy urgente</option>
          </select>
        </div>
      </section>

      {/* Exámenes */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold">
          Exámenes solicitados {examenes.length > 0 && <span className="ml-1 px-2 py-0.5 text-xs bg-teal-100 text-teal-800 rounded-full">{examenes.length}</span>}
        </h3>
        {examenes.length > 0 && (
          <div className="space-y-1">
            {examenes.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                <span className="text-sm">{e.n}</span>
                <button onClick={() => setExamenes((es) => es.filter((x) => x.id !== e.id))} className="text-[var(--ink3)] hover:text-red-500 text-lg">×</button>
              </div>
            ))}
          </div>
        )}
        <ExamSearch onSelect={(n) => setExamenes((e) => [...e, { id: Date.now(), n }])} />
        <div className="flex gap-2">
          <input className={inputCls} placeholder="O escribe el nombre del examen"
            value={newExam} onChange={(e) => setNewExam(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExam(newExam)} />
          <button onClick={() => addExam(newExam)} className="px-4 py-2 rounded-lg text-white text-sm font-semibold shrink-0" style={{ background: "#09707F" }}>+</button>
        </div>
      </section>

      {/* Modo de firma */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Modo de firma en el PDF</h3>
        <div className="flex gap-2">
          <button onClick={() => setSigMode("rubrica")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${sigMode === "rubrica" ? "bg-teal-700 text-white border-teal-700" : "border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)]"}`}>
            Firma con rúbrica (PNG)
          </button>
          <button onClick={() => setSigMode("digital")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${sigMode === "digital" ? "bg-teal-700 text-white border-teal-700" : "border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)]"}`}>
            Firma digital
          </button>
        </div>
        {sigMode === "rubrica" && !profile?.firma_url && (
          <p className="text-xs text-amber-600">No hay imagen de firma cargada — se usará firma digital automáticamente.</p>
        )}
      </section>

      <div className="flex gap-3 pt-2">
        <button onClick={() => generate(true)} disabled={generating} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition disabled:opacity-50">Vista previa</button>
        <button onClick={() => generate(false)} disabled={generating} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#09707F" }}>
          {generating ? "Generando…" : "Descargar PDF ↓"}
        </button>
      </div>
    </div>
  );
}
