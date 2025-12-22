-- =============================================================================
-- SOLUTION COMPLÈTE : Trigger auto-création settings pour nouveaux utilisateurs
-- =============================================================================
-- À exécuter dans le SQL Editor de Supabase (https://app.supabase.com)
-- Ce script est IDEMPOTENT (peut être exécuté plusieurs fois sans problème)
-- =============================================================================

-- 1. Supprimer le trigger s'il existe déjà (pour éviter les doublons)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS public.create_default_settings();

-- 3. Créer la fonction qui crée les settings par défaut
CREATE OR REPLACE FUNCTION public.create_default_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer une nouvelle ligne dans settings avec les valeurs par défaut
  INSERT INTO public.settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log l'erreur mais ne fait pas échouer l'inscription
    RAISE WARNING 'Failed to create default settings for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Créer le trigger sur auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_settings();

-- 5. Vérifier que tout fonctionne
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  proname AS function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'on_auth_user_created';

-- Si cette requête retourne une ligne, le trigger est bien créé !
