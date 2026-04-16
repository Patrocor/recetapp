-- ═══════════════════════════════════════════════════════════
--  RecetAPP — Agregar columna titulo a profiles
--  Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS titulo TEXT DEFAULT 'Dr.';
