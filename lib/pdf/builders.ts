// ═══════════════════════════════════════════════════════════
//  RecetAPP — jsPDF Builders
// ═══════════════════════════════════════════════════════════
import { jsPDF } from "jspdf";
import { MedItem, ExamItem, PdfMedico } from "@/types";

// ── helpers ────────────────────────────────────────────────

function accentRGB(hex?: string): [number, number, number] {
  if (hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return [9, 112, 127]; // default teal
}

function fL(v: string): string {
  if (!v) return "—";
  return new Date(v + "T00:00:00").toLocaleDateString("es-PE", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function addWM(doc: jsPDF, PW: number, PH: number, logo: string | null) {
  if (!logo) return;
  try {
    const ext = logo.startsWith("data:image/png") ? "PNG" : "JPEG";
    (doc as any).saveGraphicsState();
    (doc as any).setGState(new (doc as any).GState({ opacity: 0.06 }));
    doc.addImage(logo, ext, PW / 2 - 40, PH / 2 - 40, 80, 80);
    (doc as any).restoreGraphicsState();
  } catch (_) { }
}

function addFrame(doc: jsPDF, PW: number, PH: number, M: number, rgb: [number, number, number]) {
  const [r, g, b] = rgb;
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.rect(M - 2, 8, PW - 2 * (M - 2), PH - 16);
  doc.setFillColor(r, g, b);
  doc.rect(M - 2, 8, PW - 2 * (M - 2), 1.5, "F");
}

function addHdr(doc: jsPDF, PW: number, M: number, m: PdfMedico, title: string, fl: string): number {
  let y = 15;
  const rgb = accentRGB(m.config?.accentColor);
  const [r, g, b] = rgb;
  const bodyFont = m.config?.fontFamily || "helvetica";

  addFrame(doc, PW, doc.internal.pageSize.getHeight(), M, rgb);
  addWM(doc, PW, doc.internal.pageSize.getHeight(), m.logoDataUrl);

  if (m.logoDataUrl) {
    try {
      const ext = m.logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(m.logoDataUrl, ext, PW - M - 24, y - 2, 20, 14);
    } catch (_) { }
  }

  doc.setTextColor(r, g, b);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, M, y);

  if (fl) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 140, 150);
    doc.text("N° " + fl, PW - M, y, { align: "right" });
  }
  y += 5.5;

  // Contact row — omit in minimal style
  if (m.config?.headerStyle !== "minimal") {
    const info: string[] = [];
    if (m.consult) info.push(m.consult);
    if (m.dir) info.push(m.dir);
    if (m.tel) info.push("Tel: " + m.tel);
    if (m.email) info.push(m.email);
    if (info.length) {
      doc.setFontSize(7.5);
      doc.setFont(bodyFont, "normal");
      doc.setTextColor(80, 90, 100);
      doc.text(info.join("  ·  "), M, y, { maxWidth: PW - 2 * M - 24 });
      y += 4;
    }
  }

  doc.setDrawColor(200, 218, 225);
  doc.setLineWidth(0.25);
  doc.line(M, y, PW - M, y);
  y += 3.5;

  doc.setFillColor(238, 249, 251);
  (doc as any).roundedRect(M, y - 1.5, PW - 2 * M, 14, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(r, g, b);
  doc.text("MÉDICO TRATANTE", M + 3, y + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  const hdrCleanName = m.nombre.replace(/^(Dr\.|Dra\.)\s+/i, "");
  doc.text((m.titulo ? m.titulo + " " : "") + hdrCleanName, M + 3, y + 7.5);
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 80, 90);
  doc.text("CMP: " + m.cmp + (m.esp ? "  ·  " + m.esp : ""), M + 3, y + 11.5);
  return y + 17;
}

interface PacData {
  n: string; e?: string; s?: string; dni?: string; ex?: string;
}

function addPac(doc: jsPDF, PW: number, M: number, y: number, pac: PacData, m: PdfMedico): number {
  const [r, g, b] = accentRGB(m.config?.accentColor);
  const bodyFont = m.config?.fontFamily || "helvetica";
  const det: string[] = [];
  if (pac.e) det.push("Edad: " + pac.e + " años");
  if (pac.s) det.push(pac.s === "M" || pac.s === "masculino" ? "Masculino" : "Femenino");
  if (pac.dni) det.push("DNI: " + pac.dni);
  if (pac.ex && pac.ex.trim()) det.push(pac.ex.trim());
  const bH = det.length > 2 ? 17 : 14;
  doc.setFillColor(249, 248, 245);
  (doc as any).roundedRect(M, y - 1.5, PW - 2 * M, bH, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(r, g, b);
  doc.text("PACIENTE", M + 3, y + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(pac.n || "—", M + 3, y + 7.5);
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 80, 90);
  doc.text(det.join("  ·  "), M + 3, y + 11.5, { maxWidth: PW - 2 * M - 6 });
  return y + bH + 2;
}

// ── Firma — dinámica, posicionada justo después del contenido ──
function addSig(
  doc: jsPDF, PW: number, PH: number, M: number,
  mn: string, cred: string, m: PdfMedico, contentY: number,
) {
  const [r, g, b] = accentRGB(m.config?.accentColor);
  const now = new Date();
  const ts = now.toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const hash = "RX-" + Math.abs(
    mn.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)
  ).toString(16).toUpperCase().slice(0, 8);
  // Strip any title prefix already embedded in mn to avoid "Dr. Dr. Nombre"
  const cleanName = mn.replace(/^(Dr\.|Dra\.)\s+/i, "");
  const titleName = (m.titulo ? m.titulo + " " : "") + cleanName;
  const bodyFont = m.config?.fontFamily || "helvetica";

  if (m.sigMode === "digital") {
    // ── Bloque centrado, ancho dinámico según el texto más largo ──
    const hashLine = `${hash}  ·  ${ts}  ·  Ley 27269`;

    // Medir cada línea con su fuente real
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    const w1 = doc.getTextWidth("DOCUMENTO FIRMADO DIGITALMENTE");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    const w2 = doc.getTextWidth(titleName);
    doc.setFont(bodyFont, "normal"); doc.setFontSize(7.5);
    const w3 = doc.getTextWidth(cred);
    doc.setFont("courier", "normal"); doc.setFontSize(6);
    const w4 = doc.getTextWidth(hashLine);

    const padding = 14; // 7 mm a cada lado
    const bW = Math.min(Math.max(w1, w2, w3, w4) + padding, PW - 2 * M);
    const bH = 34;
    const bx = PW / 2 - bW / 2;
    const by = Math.min(contentY + 8, PH - bH - 10);
    const cx = PW / 2;
    const cy = by + 9.5;

    // Fondo semitransparente
    doc.setFillColor(r, g, b);
    try { (doc as any).setGState(new (doc as any).GState({ opacity: 0.07 })); } catch (_) { }
    (doc as any).roundedRect(bx, by, bW, bH, 2, 2, "F");
    try { (doc as any).setGState(new (doc as any).GState({ opacity: 1 })); } catch (_) { }

    // Borde
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.35);
    (doc as any).roundedRect(bx, by, bW, bH, 2, 2);

    // Círculo pequeño (r ≈ 4 mm)
    doc.setFillColor(r, g, b);
    doc.circle(cx, cy, 4, "F");

    // Check dibujado con líneas blancas
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.65);
    doc.line(cx - 2.1, cy + 0.2, cx - 0.4, cy + 2.1);   // tramo corto
    doc.line(cx - 0.4, cy + 2.1, cx + 2.4, cy - 1.6);   // tramo largo

    // "DOCUMENTO FIRMADO DIGITALMENTE"
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(r, g, b);
    doc.text("DOCUMENTO FIRMADO DIGITALMENTE", cx, by + 17.5, { align: "center" });

    // Nombre del médico
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(titleName, cx, by + 23, { align: "center" });

    // Credenciales
    doc.setFont(bodyFont, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 80, 90);
    doc.text(cred, cx, by + 28, { align: "center" });

    // Hash · timestamp · Ley 27269 (una sola línea)
    doc.setFont("courier", "normal");
    doc.setFontSize(6);
    doc.setTextColor(110, 120, 130);
    doc.text(hashLine, cx, by + 32.5, { align: "center" });

  } else {
    // ── Rúbrica / firma PNG ──
    const sw = Math.min(m.firmaSize, 96);
    const sh = Math.round(sw * 0.34);
    const firmaH = m.firmaDataUrl ? sh + 4 : 0;
    const blockH = firmaH + 20;
    const by = Math.min(contentY + 8, PH - blockH - 10);
    const fy = by + firmaH;

    if (m.firmaDataUrl) {
      try { doc.addImage(m.firmaDataUrl, "PNG", PW / 2 - sw / 2, by, sw, sh); } catch (_) { }
    }
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.line(PW / 2 - 32, fy, PW / 2 + 32, fy);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(titleName, PW / 2, fy + 5, { align: "center" });
    doc.setFont(bodyFont, "normal"); doc.setFontSize(8);
    doc.setTextColor(90, 100, 110);
    doc.text(cred, PW / 2, fy + 10, { align: "center" });
    doc.setFontSize(6.5); doc.setTextColor(160, 170, 180);
    doc.text("Firmado: " + ts, PW / 2, fy + 15, { align: "center" });
  }
}

function aLinea(doc: jsPDF, PW: number, M: number, y: number): number {
  doc.setDrawColor(205, 218, 225); doc.setLineWidth(0.2);
  doc.line(M, y, PW - M, y);
  return y + 3.5;
}

// ═══════════════════════════════════════════════════════════
//  INPUT TYPES
// ═══════════════════════════════════════════════════════════

export interface RecetaInput {
  medico: PdfMedico;
  folio: string;
  paciente: { nombre: string; dni: string; edad: string; sexo: string; fecha: string; hora: string; };
  diagnostico: string;
  indicaciones: string;
  meds: MedItem[];
  exams: ExamItem[];
}

export interface OrdenInput {
  medico: PdfMedico;
  folio: string;
  paciente: { nombre: string; dni: string; edad: string; sexo: string; fecha: string; };
  diagnostico: string;
  indicacionClinica: string;
  urgencia: string;
  examenes: ExamItem[];
}

export interface ConstanciaInput {
  medico: PdfMedico;
  folio: string;
  paciente: { nombre: string; dni: string; edad: string; sexo: string; fecha: string; hora: string; };
  tipo: string;
  diagnostico: string;
  destinatario: string;
  textoLibre: string;
}

export interface CertificadoInput {
  medico: PdfMedico;
  folio: string;
  paciente: { nombre: string; dni: string; edad: string; sexo: string; };
  fecha: string;
  diagnostico: string;
  diasReposo: number;
  fechaIni: string;
  fechaFin: string;
  textoNormativo: string;
}

// ═══════════════════════════════════════════════════════════
//  BUILDERS
// ═══════════════════════════════════════════════════════════

export function buildReceta(inp: RecetaInput): { doc: jsPDF; filename: string } {
  const { medico: m, folio, paciente: p, diagnostico: dx, indicaciones: ig, meds, exams } = inp;
  const doc = new jsPDF();
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 14;
  const [ar, ag, ab] = accentRGB(m.config?.accentColor);
  const bodyFont = m.config?.fontFamily || "helvetica";

  let y = addHdr(doc, PW, M, m, "RECETA MÉDICA", folio);
  const pac: PacData = {
    n: p.nombre, dni: p.dni, e: p.edad, s: p.sexo,
    ex: "Fecha: " + fL(p.fecha) + (p.hora ? "  " + p.hora + " h" : ""),
  };
  y = addPac(doc, PW, M, y, pac, m) + 3;

  if (dx) {
    doc.setFont(bodyFont, "italic"); doc.setFontSize(8.5); doc.setTextColor(60, 80, 100);
    const dxL = doc.splitTextToSize("Dx: " + dx, PW - 2 * M - 3);
    doc.text(dxL, M, y); y += dxL.length * 4 + 2;
  }

  const SIG_RESERVE = 38;

  if (meds.length) {
    y = aLinea(doc, PW, M, y);
    doc.setTextColor(ar, ag, ab); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Rp/", M, y); y += 5;
    const cL = M, cR = PW / 2 + 2, cW = (PW / 2) - M - 4;
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(130, 140, 150);
    doc.text("MEDICAMENTO / PRESENTACIÓN / CANT.", cL, y);
    doc.text("POSOLOGÍA", cR, y);
    y += 2.5; doc.setDrawColor(200, 215, 222); doc.setLineWidth(0.15); doc.line(M, y, PW - M, y); y += 3;
    doc.setFont(bodyFont, "normal"); doc.setFontSize(9); doc.setTextColor(17, 24, 39);
    const SIG_Y = PH - SIG_RESERVE;
    meds.forEach((med, i) => {
      const nameStr = `${i + 1}. ${med.n} ${med.p} / Cant: ${med.c}`;
      const posStr = (med.dos ? med.dos + " · " : "") + med.fr + " · " + med.du + " · " + med.vi + (med.ind ? " (" + med.ind + ")" : "");
      const tM = doc.splitTextToSize(nameStr, cW);
      const tP = doc.splitTextToSize(posStr, cW);
      const h = Math.max(tM.length, tP.length) * 4.2 + 2.5;
      if (y + h > SIG_Y - 4) {
        doc.setFontSize(7); doc.setTextColor(160, 160, 170);
        doc.text("+ " + (meds.length - i) + " med. adicionales", M, y);
        return;
      }
      doc.setFontSize(9); doc.setTextColor(17, 24, 39); doc.setFont("helvetica", "bold");
      doc.text(tM, cL, y);
      doc.setFont(bodyFont, "normal");
      doc.text(tP, cR, y);
      y += h;
    });
    y += 2;
  }

  if (exams.length && y < PH - SIG_RESERVE - 20) {
    y = aLinea(doc, PW, M, y);
    doc.setTextColor(ar, ag, ab); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
    doc.text("Exámenes auxiliares:", M, y); y += 4;
    const cW2 = (PW - 2 * M - 6) / 2;
    doc.setFont(bodyFont, "normal"); doc.setFontSize(8); doc.setTextColor(17, 24, 39);
    const maxEx = Math.floor((PH - SIG_RESERVE - y - 4) / 4.2) * 2;
    exams.slice(0, maxEx).forEach((e, i) => {
      const xPos = i % 2 === 0 ? M : M + cW2 + 6;
      doc.text((i + 1) + ". " + e.n, xPos, y, { maxWidth: cW2 });
      if (i % 2 === 1 || i === exams.length - 1) y += 4.2;
    });
    if (exams.length > maxEx) {
      doc.setFontSize(7); doc.setTextColor(160, 160, 170);
      doc.text("+" + (exams.length - maxEx) + " más", M, y); y += 3.5;
    }
    y += 1;
  }

  if (ig && y < PH - SIG_RESERVE - 16) {
    y = aLinea(doc, PW, M, y);
    doc.setTextColor(ar, ag, ab); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text("Indicaciones:", M, y); y += 4;
    doc.setFont(bodyFont, "normal"); doc.setFontSize(8.5); doc.setTextColor(30, 40, 50);
    const igL = doc.splitTextToSize(ig, PW - 2 * M);
    const maxIG = Math.floor((PH - SIG_RESERVE - y) / 4.5);
    doc.text(igL.slice(0, maxIG), M, y, { lineHeightFactor: 1.45 });
    y += Math.min(igL.length, maxIG) * 4.5 * 1.45;
  }

  addSig(doc, PW, PH, M, m.nombre, "CMP: " + m.cmp + (m.esp ? " · " + m.esp : ""), m, y);
  return { doc, filename: "Receta_" + p.nombre.replace(/\s+/g, "_") + ".pdf" };
}

export function buildOrden(inp: OrdenInput): { doc: jsPDF; filename: string } {
  const { medico: m, folio, paciente: p, diagnostico: dx, indicacionClinica: ind, urgencia: urg, examenes: ordEx } = inp;
  const doc = new jsPDF();
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 14;
  const [ar, ag, ab] = accentRGB(m.config?.accentColor);
  const bodyFont = m.config?.fontFamily || "helvetica";

  const titulo = "ORDEN DE EXÁMENES AUXILIARES" + (urg ? " — " + urg.toUpperCase() : "");
  let y = addHdr(doc, PW, M, m, titulo, folio);

  const pac: PacData = { n: p.nombre, dni: p.dni, e: p.edad, s: p.sexo, ex: "Fecha: " + fL(p.fecha) };
  y = addPac(doc, PW, M, y, pac, m) + 3;

  if (dx || ind) {
    doc.setFont(bodyFont, "normal"); doc.setFontSize(8.5); doc.setTextColor(55, 70, 85);
    if (dx) { const l = doc.splitTextToSize("Dx: " + dx, PW - 2 * M); doc.text(l, M, y); y += l.length * 4 + 1; }
    if (ind) { const l = doc.splitTextToSize("Indicación: " + ind, PW - 2 * M); doc.setFont(bodyFont, "italic"); doc.text(l, M, y); y += l.length * 4 + 1; }
    y += 1;
  }

  y = aLinea(doc, PW, M, y);
  doc.setTextColor(ar, ag, ab); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("EXÁMENES SOLICITADOS:", M, y); y += 5;

  const SIG_RESERVE = 38;
  const cW = (PW - 2 * M - 6) / 2;
  doc.setFont(bodyFont, "normal"); doc.setFontSize(9); doc.setTextColor(17, 24, 39);
  let col = 0, rowY = y;
  ordEx.forEach((e, i) => {
    if (rowY > PH - SIG_RESERVE - 10) {
      if (i === ordEx.length - 1 || col === 0) {
        doc.setFontSize(7); doc.setTextColor(155, 165, 175);
        doc.text("+" + (ordEx.length - i) + " examen(es) adicionales", M, rowY);
      }
      return;
    }
    const xPos = col === 0 ? M : M + cW + 6;
    doc.text((i + 1) + ". " + e.n, xPos, rowY, { maxWidth: cW });
    if (col === 1) { rowY += 4.8; col = 0; } else { col = 1; }
  });
  y = rowY + (col === 1 ? 4.8 : 0) + 2;

  addSig(doc, PW, PH, M, m.nombre, "CMP: " + m.cmp + (m.esp ? " · " + m.esp : ""), m, y);
  return { doc, filename: "Orden_" + p.nombre.replace(/\s+/g, "_") + ".pdf" };
}

export function buildConstancia(inp: ConstanciaInput): { doc: jsPDF; filename: string } {
  const { medico: m, folio, paciente: p, tipo, diagnostico: dx, destinatario: dest, textoLibre } = inp;
  const doc = new jsPDF();
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 14;
  const bodyFont = m.config?.fontFamily || "helvetica";

  let y = addHdr(doc, PW, M, m, "CONSTANCIA DE ATENCIÓN MÉDICA", folio);

  const pac: PacData = { n: p.nombre, dni: p.dni, e: p.edad, s: p.sexo, ex: "" };
  y = addPac(doc, PW, M, y, pac, m) + 4;
  y = aLinea(doc, PW, M, y);

  const esDra = m.titulo === "Dra.";
  const suscrito = esDra ? "La suscrita" : "El suscrito";
  const medProfesion = esDra ? "médica" : "médico";
  const nombreCompleto = (m.titulo ? m.titulo + " " : "") + m.nombre;

  const txt = textoLibre || (
    `${suscrito}, ${nombreCompleto}, ${medProfesion}${m.esp ? " " + m.esp : ""}, con Código del Colegio Médico del Perú N° ${m.cmp}, HACE CONSTAR que el/la paciente ${p.nombre}, portador/a del DNI N° ${p.dni}, de ${p.edad || "—"} años de edad, fue atendido/a en ${tipo || "consulta médica"} el día ${fL(p.fecha)}${p.hora ? " a las " + p.hora + " horas" : "."}${dx ? " Diagnóstico: " + dx + "." : ""} La presente constancia se expide a solicitud del/la interesado/a para ${dest || "los fines que el interesado estime conveniente"}.`
  );

  doc.setFont(bodyFont, "normal"); doc.setFontSize(10.5); doc.setTextColor(17, 24, 39);
  const tL = doc.splitTextToSize(txt, PW - 2 * M);
  doc.text(tL, M, y, { lineHeightFactor: 1.55 });
  y += tL.length * 5.8 + 8;

  y = aLinea(doc, PW, M, y);
  const ciudad = m.dir ? m.dir.split(",").pop()!.trim() : "Lima";
  doc.setFont(bodyFont, "italic"); doc.setFontSize(9); doc.setTextColor(80, 90, 100);
  doc.text(ciudad + ", " + fL(p.fecha) + ".", M, y);
  y += 6;

  addSig(doc, PW, PH, M, m.nombre, "CMP: " + m.cmp + (m.esp ? " · " + m.esp : ""), m, y);
  return { doc, filename: "Constancia_" + p.nombre.replace(/\s+/g, "_") + ".pdf" };
}

export function buildCertificado(inp: CertificadoInput): { doc: jsPDF; filename: string } {
  const { medico: m, folio, paciente: p, textoNormativo } = inp;

  const doc = new jsPDF();
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 14;
  const bodyFont = m.config?.fontFamily || "helvetica";

  let y = addHdr(doc, PW, M, m, "CERTIFICADO MÉDICO", folio);

  // Patient pill
  const pac: PacData = { n: p.nombre, dni: p.dni, e: p.edad, s: p.sexo };
  y = addPac(doc, PW, M, y, pac, m) + 6;

  // Certificate body text (preserving \n line breaks)
  const txt = textoNormativo.trim();
  doc.setFont(bodyFont, "normal"); doc.setFontSize(10.5); doc.setTextColor(17, 24, 39);
  const lineH = 5.8;
  txt.split("\n").forEach((paragraph) => {
    if (!paragraph.trim()) { y += lineH * 0.7; return; }
    const lines = doc.splitTextToSize(paragraph, PW - 2 * M);
    doc.text(lines, M, y, { lineHeightFactor: 1.55 });
    y += lines.length * lineH;
  });
  y += 8;

  // "Atentamente,"
  doc.setFont(bodyFont, "italic"); doc.setFontSize(10); doc.setTextColor(50, 60, 70);
  doc.text("Atentamente,", M, y);
  y += 18; // space for physical stamp / signature

  addSig(doc, PW, PH, M, m.nombre, "CMP " + m.cmp + (m.esp ? "  ·  " + m.esp : ""), m, y);
  return { doc, filename: "Certificado_" + p.nombre.replace(/\s+/g, "_") + ".pdf" };
}
