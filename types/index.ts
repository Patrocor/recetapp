// ── PDF customisation config ──
export interface PdfConfig {
  accentColor?: string;                          // hex "#RRGGBB"
  fontFamily?: "helvetica" | "times" | "courier";
  headerStyle?: "standard" | "minimal";          // minimal hides contact row
}

// ── Doctor profile stored in Supabase `profiles` table ──
export interface DoctorProfile {
  id: string;
  username: string;
  titulo: string;   // "Dr." | "Dra."
  nombre: string;
  cmp: string;
  especialidad: string;
  consultorio: string;
  direccion: string;
  telefono: string;
  email_contacto: string;
  logo_url: string | null;
  firma_url: string | null;
  firma_size: number;
  sig_mode: "rubrica" | "digital";
  is_admin: boolean;
  pdf_config?: PdfConfig;
}

// ── User access record (admin panel) ──
export interface UserAccess {
  id: string;
  username: string;
  nombre: string;
  contact: string;
  exp_at: string | null;   // ISO timestamp or null (permanent)
  active: boolean;
  docs_count: number;
  created_by: string;
  created_at: string;
}

// ── Document history entry ──
export interface DocRecord {
  id: string;
  user_id: string;
  tipo: "receta" | "orden" | "const" | "cert";
  folio: string;
  paciente: string;
  fecha: string;
  diagnostico: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Admin log entry ──
export interface AdminLogEntry {
  id: string;
  tipo: string;
  actor: string;
  target: string;
  descripcion: string;
  created_at: string;
}

// ── jsPDF builder input ──
export interface MedItem {
  id: number;
  n: string;   // nombre
  p: string;   // presentación
  c: string;   // cantidad
  dos: string; // dosis
  fr: string;  // frecuencia
  du: string;  // duración
  vi: string;  // vía
  ind: string; // indicación adicional
}

export interface ExamItem {
  id: number;
  n: string; // nombre
}

export interface PdfMedico {
  titulo: string;   // "Dr." | "Dra."
  nombre: string;
  cmp: string;
  esp: string;
  consult: string;
  dir: string;
  tel: string;
  email: string;
  logoDataUrl: string | null;
  firmaDataUrl: string | null;
  firmaSize: number;
  sigMode: "rubrica" | "digital";
  config?: PdfConfig;
}
