-- ============================================================================
-- SETUP COMPLET: Isolation multi-utilisateurs + RLS
-- ============================================================================
-- À exécuter dans Supabase SQL Editor (https://app.supabase.com)
-- Ce script est IDEMPOTENT (peut être exécuté plusieurs fois)
-- ============================================================================

-- 1. VÉRIFIER/CRÉER LES TABLES (si elles n'existent pas)
-- ----------------------------------------------------------------------------

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Settings table (si elle n'existe pas déjà)
CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_cards_per_day INTEGER NOT NULL DEFAULT 20,
  max_reviews_per_day INTEGER NOT NULL DEFAULT 9999,
  learning_mode TEXT NOT NULL DEFAULT 'normal' CHECK (learning_mode IN ('fast', 'normal', 'deep')),
  again_delay_minutes INTEGER NOT NULL DEFAULT 10,
  review_order TEXT NOT NULL DEFAULT 'mixed' CHECK (review_order IN ('mixed', 'oldFirst', 'newFirst')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ACTIVER RLS SUR TOUTES LES TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 3. SUPPRIMER LES ANCIENNES POLICIES (pour réappliquer les bonnes)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own decks" ON decks;
DROP POLICY IF EXISTS "Users can create their own decks" ON decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON decks;

DROP POLICY IF EXISTS "Users can view their own cards" ON cards;
DROP POLICY IF EXISTS "Users can create their own cards" ON cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON cards;

DROP POLICY IF EXISTS "Users can view their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;

DROP POLICY IF EXISTS "Users can view their own imports" ON imports;
DROP POLICY IF EXISTS "Users can create their own imports" ON imports;
DROP POLICY IF EXISTS "Users can update their own imports" ON imports;
DROP POLICY IF EXISTS "Users can delete their own imports" ON imports;

DROP POLICY IF EXISTS "Users can view their own generated_cards" ON generated_cards;
DROP POLICY IF EXISTS "Users can create their own generated_cards" ON generated_cards;
DROP POLICY IF EXISTS "Users can update their own generated_cards" ON generated_cards;
DROP POLICY IF EXISTS "Users can delete their own generated_cards" ON generated_cards;

DROP POLICY IF EXISTS "Users can view their own settings" ON settings;
DROP POLICY IF EXISTS "Users can create their own settings" ON settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON settings;

-- 4. CRÉER LES POLICIES RLS STRICTES
-- ----------------------------------------------------------------------------

-- DECKS policies
CREATE POLICY "Users can view their own decks"
  ON decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own decks"
  ON decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
  ON decks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
  ON decks FOR DELETE
  USING (auth.uid() = user_id);

-- CARDS policies
CREATE POLICY "Users can view their own cards"
  ON cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cards"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id);

-- REVIEWS policies
CREATE POLICY "Users can view their own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- IMPORTS policies
CREATE POLICY "Users can view their own imports"
  ON imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own imports"
  ON imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imports"
  ON imports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imports"
  ON imports FOR DELETE
  USING (auth.uid() = user_id);

-- GENERATED_CARDS policies
CREATE POLICY "Users can view their own generated_cards"
  ON generated_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generated_cards"
  ON generated_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated_cards"
  ON generated_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated_cards"
  ON generated_cards FOR DELETE
  USING (auth.uid() = user_id);

-- SETTINGS policies
CREATE POLICY "Users can view their own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
  ON settings FOR DELETE
  USING (auth.uid() = user_id);

-- 5. TRIGGER AUTO-CRÉATION SETTINGS
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_default_settings();

CREATE OR REPLACE FUNCTION public.create_default_settings()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create default settings for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_settings();

-- 6. VÉRIFICATIONS
-- ----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('decks', 'cards', 'reviews', 'imports', 'generated_cards', 'settings')
ORDER BY tablename;

-- Doit retourner 6 lignes avec rls_enabled = true

SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public';

-- Doit retourner environ 24 policies (4 par table × 6 tables)

SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- Doit retourner 1 ligne confirmant le trigger
