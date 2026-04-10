"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import DxSearch from "@/components/ui/DxSearch";
import MedSearch from "@/components/ui/MedSearch";
import ExamSearch from "@/components/ui/ExamSearch";
import { MedItem, ExamItem, DoctorProfile } from "@/types";
import { newFolio, formatDateLong } from "@/lib/utils";
import { generateFolio } from "@/lib/pdf/folio";
import { INDIC_DB } from "@/lib/data/indicaciones";
import { tpls } from "@/lib/data/indicaciones";
import { buildReceta } from "@/lib/pdf/builders";
import { loadProfileImages } from "@/lib/pdf/loadImage";
import { saveHistory } from "@/lib/pdf/saveHistory";

const LAST_PAT_KEY = "recetapp_lastpat";

function todayISO() { return new Date().toISOString().split("T")[0]; }
function nowTime() {
  const n = new Date();
  return String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0");
}

export default function RecetaPage() {
  return <ToastProvider><RecetaForm /></ToastProvider>;
}

function RecetaForm() {
  const toast = useToast();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [folio, setFolio] = useState(newFolio());
  const [pat, setPat] = useState({ nombre: "", dni: "", edad: "", sexo: "", fecha: todayISO(), hora: nowTime() });
  const [dx, setDx] = useState("");
  const [indG, setIndG] = useState("");
  const [meds, setMeds] = useState<MedItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [newMed, setNewMed] = useState({ n: "", p: "", c: "", dos: "", fr: "", du: "", vi: "", ind: "" });
  const [newExam, setNewExam] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showTpls, setShowTpls] = useState(false);
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

  function setP(k: string, v: string) { setPat((f) => ({ ...f, [k]: v })); }
  function setM(k: string, v: string) { setNewMed((f) => ({ ...f, [k]: v })); }

  function usarPacienteAnterior() {
    const raw = localStorage.getItem(LAST_PAT_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      setPat({ ...saved, fecha: todayISO(), hora: nowTime() });
      toast("Datos del paciente anterior cargados", "ok");
    } catch {}
  }

  function addMed() {
    if (!newMed.n || !newMed.p || !newMed.c) { toast("Completa nombre, presentación y cantidad."); return; }
    if (!newMed.fr) { toast("Selecciona la frecuencia."); return; }
    if (!newMed.du) { toast("Selecciona la duración."); return; }
    if (!newMed.vi) { toast("Selecciona la vía."); return; }
    setMeds((m) => [...m, { ...newMed, id: Date.now() }]);
    setNewMed({ n: "", p: "", c: "", dos: "", fr: "", du: "", vi: "", ind: "" });
    toast("Medicamento agregado", "ok");
  }

  function addExam() {
    if (!newExam.trim()) { toast("Escribe el nombre del examen."); return; }
    setExams((e) => [...e, { id: Date.now(), n: newExam.trim() }]);
    setNewExam("");
    toast("Examen agregado", "ok");
  }

  function genIA() {
    const buscar = (dx + " " + meds.map((m) => m.n).join(" ")).toLowerCase();
    if (!dx && !meds.length) { toast("Agrega un diagnóstico o medicamento primero."); return; }
    let best: string | null = null, bestScore = 0;
    for (const patron of Object.values(INDIC_DB)) {
      let score = 0;
      for (const key of patron.keys) {
        const k = key.toLowerCase();
        if (buscar.includes(k)) score += k.length > 4 ? 3 : 2;
        if (dx.toLowerCase().includes(k)) score += 2;
      }
      if (score > bestScore) { bestScore = score; best = patron.txt; }
    }
    if (best && bestScore > 0) {
      setIndG(best);
      toast("Indicaciones cargadas según el diagnóstico ✓", "ok");
    } else {
      setIndG("Tome los medicamentos indicados en el horario exacto, con o sin alimentos según indicación. Beba líquidos abundantes (2-3 litros de agua al día). Reposo relativo según tolerancia. Evite el alcohol y el tabaco durante el tratamiento. No se automedique ni suspenda el tratamiento sin consultar. Regrese a control en la fecha indicada o antes si los síntomas empeoran.");
      toast("Indicaciones generales cargadas", "inf");
    }
  }

  function applyTpl(i: number) {
    const t = tpls[i];
    setDx(t.dx);
    setIndG(t.ind);
    setMeds(t.meds.map((m) => ({ ...m, id: Date.now() + Math.random() })));
    setExams(t.exs.map((e) => ({ id: Date.now() + Math.random(), n: e.n })));
    setShowTpls(false);
    toast(`Plantilla "${t.n}" cargada`, "ok");
  }

  async function generate(preview = false) {
    if (!profile?.nombre || !profile?.cmp) { toast("Perfil incompleto. Abre el Perfil arriba."); return; }
    if (!pat.nombre.trim() || !pat.edad.trim() || !pat.fecha) { toast("Completa nombre, edad y fecha del paciente."); return; }
    if (!meds.length && !exams.length) { toast("Agrega al menos un medicamento o examen."); return; }

    setGenerating(true);
    try {
      // Save patient for other pages
      localStorage.setItem(LAST_PAT_KEY, JSON.stringify({ nombre: pat.nombre, dni: pat.dni, edad: pat.edad, sexo: pat.sexo }));

      // Load images from Supabase Storage
      const effectiveSigMode = sigMode === "rubrica" && !profile.firma_url ? "digital" : sigMode;
      const { firmaDataUrl, logoDataUrl } = await loadProfileImages(
        effectiveSigMode === "rubrica" ? profile.firma_url : null,
        profile.logo_url,
      );

      const realFolio = await generateFolio(pat.nombre, "R");
      setFolio(realFolio);
      const { doc, filename } = buildReceta({
        medico: {
          titulo: profile.titulo || "Dr.",
          nombre: profile.nombre, cmp: profile.cmp, esp: profile.especialidad || "",
          consult: profile.consultorio || "", dir: profile.direccion || "",
          tel: profile.telefono || "", email: profile.email_contacto || "",
          logoDataUrl, firmaDataUrl,
          firmaSize: profile.firma_size || 90, sigMode: effectiveSigMode,
          config: profile.pdf_config,
        },
        folio: realFolio, paciente: pat, diagnostico: dx, indicaciones: indG, meds, exams,
      });

      if (preview) {
        const url = doc.output("bloburl");
        window.open(url, "_blank");
      } else {
        doc.save(filename);
        toast("Receta descargada ✓", "ok");
      }

      await saveHistory("receta", realFolio, pat.nombre, formatDateLong(pat.fecha), dx, {
        meds: meds.length, exams: exams.length,
      });
    } catch (e: any) {
      toast("Error al generar PDF: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  function nuevaReceta() {
    if (!confirm("¿Iniciar una nueva receta? Se perderán los datos actuales.")) return;
    setPat({ nombre: "", dni: "", edad: "", sexo: "", fecha: todayISO(), hora: nowTime() });
    setDx(""); setIndG(""); setMeds([]); setExams([]);
    setFolio(newFolio());
    toast("Nueva receta lista", "ok");
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide mb-1 text-[var(--ink2)]";
  const selectCls = inputCls;

  return (
    <div className="space-y-5 pb-20">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[var(--ink)]">💊 Receta Médica</h2>
          <p className="text-xs text-[var(--ink3)]">Folio: {folio}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTpls((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition">
            Plantillas
          </button>
          <button onClick={nuevaReceta}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition">
            + Nueva
          </button>
        </div>
      </div>

      {/* Plantillas grid */}
      {showTpls && (
        <div className="border border-[var(--brd)] rounded-xl p-4 bg-[var(--card)]">
          <p className="text-xs font-bold text-[var(--ink3)] uppercase tracking-wide mb-3">Plantillas rápidas</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {tpls.map((t, i) => (
              <button key={i} onClick={() => applyTpl(i)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl border border-[var(--brd)] hover:bg-teal-50 hover:border-teal-300 transition text-center">
                <span className="text-xl">{t.i}</span>
                <span className="text-[11px] font-medium text-[var(--ink2)] leading-tight">{t.n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paciente */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Datos del paciente</h3>
          {hasPrevPat && (
            <button onClick={usarPacienteAnterior}
              className="text-xs px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 transition">
              Usar paciente anterior
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Nombre completo *</label>
            <input className={inputCls} placeholder="Apellidos y nombres" value={pat.nombre} onChange={(e) => setP("nombre", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>DNI</label>
            <input className={inputCls} placeholder="12345678" value={pat.dni} onChange={(e) => setP("dni", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Edad *</label>
            <input className={inputCls} placeholder="45 años" value={pat.edad} onChange={(e) => setP("edad", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Sexo</label>
            <select className={selectCls} value={pat.sexo} onChange={(e) => setP("sexo", e.target.value)}>
              <option value="">—</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Fecha *</label>
            <input type="date" className={inputCls} value={pat.fecha} onChange={(e) => setP("fecha", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Hora</label>
            <input type="time" className={inputCls} value={pat.hora} onChange={(e) => setP("hora", e.target.value)} />
          </div>
        </div>
      </section>

      {/* Diagnóstico */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Diagnóstico CIE-10</h3>
        <DxSearch value={dx} onChange={setDx} />
      </section>

      {/* Medicamentos */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--ink)]">
            Medicamentos {meds.length > 0 && <span className="ml-1 px-2 py-0.5 text-xs bg-teal-100 text-teal-800 rounded-full">{meds.length}</span>}
          </h3>
        </div>

        {meds.length > 0 && (
          <div className="space-y-2">
            {meds.map((m, i) => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink)] truncate">{i + 1}. {m.n} <span className="font-normal text-[var(--ink3)]">{m.p}</span></p>
                  <p className="text-xs text-[var(--ink2)]">{m.dos && m.dos + " · "}{m.fr} · {m.du} · {m.vi} · Cant: {m.c}</p>
                  {m.ind && <p className="text-xs text-[var(--ink3)] italic">{m.ind}</p>}
                </div>
                <button onClick={() => setMeds((ms) => ms.filter((x) => x.id !== m.id))}
                  className="text-[var(--ink3)] hover:text-red-500 text-lg leading-none shrink-0">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-[var(--brd)]">
          <MedSearch onSelect={(m) => setNewMed((f) => ({ ...f, n: m.d, p: m.p, vi: m.v }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre genérico</label>
              <input className={inputCls} placeholder="Paracetamol" value={newMed.n} onChange={(e) => setM("n", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Presentación</label>
              <input className={inputCls} placeholder="500 mg tabletas" value={newMed.p} onChange={(e) => setM("p", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Dosis</label>
              <input className={inputCls} placeholder="500 mg" value={newMed.dos} onChange={(e) => setM("dos", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Cantidad</label>
              <input className={inputCls} placeholder="20 tabletas" value={newMed.c} onChange={(e) => setM("c", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Frecuencia *</label>
              <select className={selectCls} value={newMed.fr} onChange={(e) => setM("fr", e.target.value)}>
                <option value="">Seleccionar…</option>
                {["Cada 4 horas","Cada 6 horas","Cada 8 horas","Cada 12 horas","Cada 24 horas","2 veces al día","3 veces al día","Con el desayuno y cena","Dosis única","Según necesidad (PRN)"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Duración *</label>
              <select className={selectCls} value={newMed.du} onChange={(e) => setM("du", e.target.value)}>
                <option value="">Seleccionar…</option>
                {["1 día","2 días","3 días","5 días","7 días","10 días","14 días","21 días","30 días","45 días","60 días","90 días","Uso indefinido","1 dosis única","Según respuesta"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vía *</label>
              <select className={selectCls} value={newMed.vi} onChange={(e) => setM("vi", e.target.value)}>
                <option value="">Seleccionar…</option>
                {["Vía oral","Vía sublingual","Vía tópica","Vía oftálmica","Vía ótica","Vía nasal","Vía inhalatoria","Vía vaginal","Vía rectal","Vía subcutánea","Vía intramuscular","Vía intravenosa"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Indicación adicional</label>
              <input className={inputCls} placeholder="Con alimentos, en ayunas…" value={newMed.ind} onChange={(e) => setM("ind", e.target.value)} />
            </div>
          </div>
          <button onClick={addMed}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: "#09707F" }}>
            + Agregar medicamento
          </button>
        </div>
      </section>

      {/* Exámenes */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          Exámenes auxiliares {exams.length > 0 && <span className="ml-1 px-2 py-0.5 text-xs bg-teal-100 text-teal-800 rounded-full">{exams.length}</span>}
        </h3>
        {exams.length > 0 && (
          <div className="space-y-1">
            {exams.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                <span className="text-sm text-[var(--ink)]">{e.n}</span>
                <button onClick={() => setExams((es) => es.filter((x) => x.id !== e.id))} className="text-[var(--ink3)] hover:text-red-500 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <ExamSearch onSelect={(n) => setExams((e) => [...e, { id: Date.now(), n }])} placeholder="Busca o escribe un examen…" />
          </div>
        </div>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="O escribe el nombre del examen"
            value={newExam} onChange={(e) => setNewExam(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExam()} />
          <button onClick={addExam} className="px-4 py-2 rounded-lg text-white text-sm font-semibold shrink-0" style={{ background: "#09707F" }}>
            +
          </button>
        </div>
      </section>

      {/* Indicaciones */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Indicaciones al paciente</h3>
          <button onClick={genIA}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
            style={{ background: "#09707F" }}>
            IA →
          </button>
        </div>
        <textarea className={inputCls + " h-32 resize-none"} placeholder="Escribe las indicaciones o usa el botón IA para generarlas automáticamente según el diagnóstico…"
          value={indG} onChange={(e) => setIndG(e.target.value)} />
      </section>

      {/* Modo de firma */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Modo de firma en el PDF</h3>
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
          <p className="text-xs text-amber-600">No hay imagen de firma cargada — se usará firma digital automáticamente. Sube tu firma en el Perfil.</p>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button onClick={() => generate(true)} disabled={generating}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[var(--brd)] text-[var(--ink2)] hover:bg-[var(--bg2)] transition disabled:opacity-50">
          Vista previa
        </button>
        <button onClick={() => generate(false)} disabled={generating}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition"
          style={{ background: "#09707F" }}>
          {generating ? "Generando…" : "Descargar PDF ↓"}
        </button>
      </div>
    </div>
  );
}
