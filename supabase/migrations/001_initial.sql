-- ═══════════════════════════════════════════════════════════
--  RecetAPP — Schema inicial
--  Ejecutar en el SQL Editor de Supabase (o con supabase db push)
-- ═══════════════════════════════════════════════════════════

-- ── PROFILES ────────────────────────────────────────────────
-- Perfil médico de cada usuario autenticado.
-- Se crea automáticamente al crear el usuario en Supabase Auth.
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  nombre          TEXT,
  cmp             TEXT,
  especialidad    TEXT,
  consultorio     TEXT,
  direccion       TEXT,
  telefono        TEXT,
  email_contacto  TEXT,
  logo_url        TEXT,       -- URL en Supabase Storage
  firma_url       TEXT,       -- URL en Supabase Storage
  firma_size      INTEGER DEFAULT 90,
  sig_mode        TEXT DEFAULT 'rubrica',  -- 'rubrica' | 'digital'
  is_admin        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── USER ACCESS ─────────────────────────────────────────────
-- Control de accesos gestionado desde el panel admin.
-- Expiry y active se manejan aquí; auth vive en auth.users.
CREATE TABLE IF NOT EXISTS user_access (
  id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  nombre      TEXT,
  contact     TEXT,
  exp_at      TIMESTAMPTZ,    -- NULL = sin vencimiento
  active      BOOLEAN DEFAULT TRUE,
  docs_count  INTEGER DEFAULT 0,
  created_by  TEXT,           -- username del admin que lo creó
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── DOCUMENTS ───────────────────────────────────────────────
-- Historial de documentos PDF generados.
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  user_id     UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  tipo        TEXT NOT NULL,  -- 'receta' | 'orden' | 'const' | 'cert'
  folio       TEXT,
  paciente    TEXT,
  fecha       TEXT,
  diagnostico TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ADMIN LOG ───────────────────────────────────────────────
-- Registro de actividad para el panel de administrador.
CREATE TABLE IF NOT EXISTS admin_log (
  id          UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  tipo        TEXT NOT NULL,
  actor       TEXT NOT NULL,
  target      TEXT,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_log   ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuario ve y edita solo el suyo
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Función SECURITY DEFINER para verificar is_admin sin recursión RLS
-- SECURITY DEFINER bypasea RLS al consultar profiles internamente
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
$$;

-- profiles: admins ven todos
CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  USING (public.is_admin_user());

-- user_access: cada usuario ve el suyo
CREATE POLICY "user_access_select_own"
  ON user_access FOR SELECT
  USING (auth.uid() = id);

-- user_access: solo admins gestionan todos
CREATE POLICY "user_access_admin_all"
  ON user_access FOR ALL
  USING (public.is_admin_user());

-- documents: cada usuario gestiona los suyos
CREATE POLICY "documents_own"
  ON documents FOR ALL
  USING (auth.uid() = user_id);

-- admin_log: solo admins
CREATE POLICY "admin_log_admin_all"
  ON admin_log FOR ALL
  USING (public.is_admin_user());

-- ═══════════════════════════════════════════════════════════
--  FUNCIONES Y TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Auto-actualizar updated_at en profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  STORAGE
-- ═══════════════════════════════════════════════════════════
-- Crear buckets en el Dashboard de Supabase → Storage:
--   "logos"   (public: false, max size: 2MB)
--   "firmas"  (public: false, max size: 1MB)
-- O ejecutar con la API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('firmas', 'firmas', false);
