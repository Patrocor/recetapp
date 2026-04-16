-- ═══════════════════════════════════════════════════════════
--  RecetAPP — Storage buckets y políticas RLS
--  Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── CREAR BUCKETS ───────────────────────────────────────────
-- Bucket para firmas/rúbricas (privado, máx. 1 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'firmas',
  'firmas',
  false,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para logos de consultorio (privado, máx. 2 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  false,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;


-- ── POLÍTICAS RLS — FIRMAS ──────────────────────────────────
-- Cada usuario solo puede subir, leer, actualizar y borrar
-- archivos dentro de su propia carpeta: {user_id}/firma.png

-- INSERT (subir)
CREATE POLICY "firmas_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'firmas' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT (leer / generar signed URL)
CREATE POLICY "firmas_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'firmas' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE (upsert)
CREATE POLICY "firmas_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'firmas' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE (quitar firma)
CREATE POLICY "firmas_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'firmas' AND
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ── POLÍTICAS RLS — LOGOS ───────────────────────────────────

-- INSERT
CREATE POLICY "logos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT
CREATE POLICY "logos_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE
CREATE POLICY "logos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE
CREATE POLICY "logos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
