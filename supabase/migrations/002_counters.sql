-- ═══════════════════════════════════════════════════════════
--  RecetAPP — Contadores de folios por tipo de documento
--  Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Tabla de contadores
CREATE TABLE IF NOT EXISTS public.counters (
  type        TEXT    PRIMARY KEY,
  current_val BIGINT  NOT NULL DEFAULT 0
);

-- Valores iniciales para cada tipo de documento
INSERT INTO public.counters (type, current_val)
  VALUES ('R', 0), ('O', 0), ('Co', 0), ('Cer', 0)
  ON CONFLICT (type) DO NOTHING;

-- RLS
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counters_read_auth" ON public.counters
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Función atómica para incrementar y devolver el nuevo valor
CREATE OR REPLACE FUNCTION public.increment_counter(p_type TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_val BIGINT;
BEGIN
  INSERT INTO public.counters (type, current_val)
    VALUES (p_type, 1)
  ON CONFLICT (type) DO UPDATE
    SET current_val = counters.current_val + 1
  RETURNING current_val INTO new_val;
  RETURN new_val;
END;
$$;

-- Columna pdf_config en profiles (para personalización PDF)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pdf_config JSONB DEFAULT '{}';
