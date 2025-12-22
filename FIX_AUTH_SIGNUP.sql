-- ============================================================================
-- FIX: "Database error saving new user"
-- ============================================================================
-- CAUSE: Le trigger on_auth_user_created n'existe pas ou plante
-- SOLUTION: Créer le trigger qui auto-crée une ligne dans settings
-- ============================================================================

-- 1. Nettoyer l'ancien trigger s'il existe (évite les doublons)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_default_settings();

-- 2. Créer la fonction qui insère dans settings
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
END;
$$;

-- 3. Créer le trigger sur auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_settings();

-- 4. VÉRIFICATION: Afficher le trigger créé
SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- Si cette requête retourne une ligne, le trigger est actif ✅
