"use client";

import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import DxSearch from "@/components/ui/DxSearch";
import { useProfile } from "@/lib/context/profile";
import { formatDateLong } from "@/lib/utils";
import { buildConstancia } from "@/lib/pdf/builders";
import { loadProfileImages } from "@/lib/pdf/loadImage";
import { saveHistory } from "@/lib/pdf/saveHistory";
import { generateFolio } from "@/lib/pdf/folio";

const LAST_PAT_KEY = "recetapp_lastpat";
function todayISO() { return new Date().toISOString().split("T")[0]; }
function nowTime() {
  const n = new Date();
  return String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0");
}

const TIPOS = ["Consulta médica","Consulta de urgencias","Hospitalización","Cirugía ambulatoria","Procedimiento diagnóstico","Procedimiento terapéutico","Atención domiciliaria","Telemedicina"];
const DESTINOS = ["los fines que el interesado estime conveniente","el empleador","la entidad de seguro","el centro educativo","la entidad gubernamental","el trámite que corresponda"];

export default function ConstanciaPage() {
  return <ToastProvider><ConstanciaForm /></ToastProvider>;
}

function ConstanciaForm() {
  const toast = useToast();
  const { profile } = useProfile();
  const [pat, setPat] = useState({ nombre: "", dni: "", edad: "", sexo: "", fecha: todayISO(), hora: nowTime() });
  const [tipo, setTipo] = useState("");
  const [dx, setDx] = useState("");
  const [dest, setDest] = useState("");
  const [textoLibre, setTextoLibre] = useState("");
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

  function generarTexto() {
    if (!profile?.nombre || !profile?.cmp) { toast("Completa tu perfil primero."); return; }
    if (!pat.nombre || !pat.dni || !pat.fecha) { toast("Completa nombre, DNI y fecha del paciente primero."); return; }
    const m = profile;
    const esDra = m.titulo === "Dra.";
    const suscrito = esDra ? "La suscrita" : "El suscrito";
    const medProfesion = esDra ? "médica" : "médico";
    const titulo = m.titulo || "Dr.";
    const nombreCompleto = `${titulo} ${m.nombre}`;

    const txt =
      `${suscrito}, ${nombreCompleto}, ${medProfesion}${m.especialidad ? " " + m.especialidad : ""}, con Código del Colegio Médico del Perú N° ${m.cmp}, HACE CONSTAR que el/la paciente ${pat.nombre}, portador/a del DNI N° ${pat.dni}, de ${pat.edad || "—"} años de edad, fue atendido/a en ${tipo || "consulta médica"} el día ${formatDateLong(pat.fecha)}${pat.hora ? " a las " + pat.hora + " horas" : "."}${dx ? " Diagnóstico: " + dx + "." : ""} La presente constancia se expide a solicitud del/la interesado/a para ${dest || "los fines que el interesado estime conveniente"}.`;
    setTextoLibre(txt);
    toast("Texto normativo generado ✓", "ok");
  }

  async function generate(preview = false) {
    if (!profile?.nombre || !profile?.cmp) { toast("Perfil incompleto."); return; }
    if (!pat.nombre.trim() || !pat.dni.trim() || !pat.fecha) { toast("Completa nombre, DNI y fecha."); return; }
    if (!tipo) { toast("Selecciona el tipo de consulta."); return; }

    setGenerating(true);
    try {
      const effectiveSigMode = sigMode === "rubrica" && !profile.firma_url ? "digital" : sigMode;
      const { firmaDataUrl, logoDataUrl } = await loadProfileImages(
        effectiveSigMode === "rubrica" ? profile.firma_url : null,
        profile.logo_url,
      );

      const folio = await generateFolio(pat.nombre, "Co");
      const { doc, filename } = buildConstancia({
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
        paciente: pat, tipo, diagnostico: dx,
        destinatario: dest, textoLibre,
      });

      if (preview) window.open(doc.output("bloburl"), "_blank");
      else { doc.save(filename); toast("Constancia descargada ✓", "ok"); }

      await saveHistory("const", folio, pat.nombre, formatDateLong(pat.fecha), dx, { tipo });
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
      <h2 className="font-semibold text-[var(--ink)]">📋 Constancia de Atención Médica</h2>

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
          <div><label className={labelCls}>Nombre *</label><input className={inputCls} value={pat.nombre} onChange={(e) => setP("nombre", e.target.value)} /></div>
          <div><label className={labelCls}>DNI *</label><input className={inputCls} value={pat.dni} onChange={(e) => setP("dni", e.target.value)} /></div>
          <div><label className={labelCls}>Edad</label><input className={inputCls} value={pat.edad} onChange={(e) => setP("edad", e.target.value)} /></div>
          <div>
            <label className={labelCls}>Sexo</label>
            <select className={inputCls} value={pat.sexo} onChange={(e) => setP("sexo", e.target.value)}>
              <option value="">—</option><option value="M">Masculino</option><option value="F">Femenino</option>
            </select>
          </div>
          <div><label className={labelCls}>Fecha *</label><input type="date" className={inputCls} value={pat.fecha} onChange={(e) => setP("fecha", e.target.value)} /></div>
          <div><label className={labelCls}>Hora</label><input type="time" className={inputCls} value={pat.hora} onChange={(e) => setP("hora", e.target.value)} /></div>
        </div>
      </section>

      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <h3 className="text-sm font-semibold">Tipo de atención</h3>
        <div>
          <label className={labelCls}>Tipo de consulta *</label>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Seleccionar…</option>
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Diagnóstico (opcional)</label>
          <DxSearch value={dx} onChange={setDx} placeholder="Busca por nombre o código CIE-10…" />
        </div>
        <div>
          <label className={labelCls}>Destinatario</label>
          <select className={inputCls} value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value="">Seleccionar…</option>
            {DESTINOS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </section>

      <section className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Texto de la constancia</h3>
          <button onClick={generarTexto} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#09707F" }}>
            Generar texto
          </button>
        </div>
        <textarea
          className={inputCls + " h-40 resize-none"}
          placeholder="El texto normativo se genera automáticamente al hacer clic en 'Generar texto', o puedes escribirlo libremente…"
          value={textoLibre}
          onChange={(e) => setTextoLibre(e.target.value)}
        />
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
