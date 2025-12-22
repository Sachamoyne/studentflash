# Fix Supabase Authentication - Instructions

## Problème identifié

**Erreur :** "Database error saving new user"

**Cause :** Le trigger `on_auth_user_created` n'existe pas dans votre base de données Supabase distante. Ce trigger est censé créer automatiquement une entrée dans la table `settings` quand un utilisateur s'inscrit.

## Solution (5 minutes)

### 1. Appliquer le trigger dans Supabase Dashboard

1. Ouvrez https://app.supabase.com
2. Sélectionnez votre projet **ANKIbis**
3. Cliquez sur **SQL Editor** dans le menu de gauche
4. Cliquez sur **New query**
5. Copiez-collez le contenu du fichier `supabase/fix-trigger.sql`
6. Cliquez sur **Run** (ou appuyez sur Ctrl/Cmd + Enter)

**Résultat attendu :**
```
✅ Trigger 'on_auth_user_created' créé avec succès
✅ Une ligne retournée avec :
   - trigger_name: on_auth_user_created
   - table_name: users
   - function_name: create_default_settings
```

### 2. Tester l'inscription

Après avoir appliqué le trigger, testez l'inscription :

**Option A - Via le script de test :**
```bash
node test-signup.js
```

**Résultat attendu :**
```
✅ Signup successful!
✅ Settings created successfully
```

**Option B - Via l'interface web :**
1. Lancez `npm run dev`
2. Allez sur http://localhost:3000
3. Cliquez sur "Open app"
4. Cliquez sur "Sign up" sur la page de login
5. Créez un compte avec un email et mot de passe
6. Vous devriez être redirigé vers `/dashboard` sans erreur

### 3. Vérifier que tout fonctionne

Après une inscription réussie, vérifiez dans le dashboard Supabase :

1. Allez dans **Table Editor**
2. Ouvrez la table **auth.users** → vous devriez voir votre utilisateur
3. Ouvrez la table **settings** → vous devriez voir une ligne avec le même `user_id`

## Pourquoi cette solution est production-ready

✅ **Trigger automatique** - Chaque nouvel utilisateur aura automatiquement ses settings créés
✅ **Gestion d'erreurs** - Si la création des settings échoue, l'inscription ne sera pas bloquée (WARNING au lieu d'erreur fatale)
✅ **Idempotent** - Le script peut être exécuté plusieurs fois sans problème
✅ **SECURITY DEFINER** - Le trigger s'exécute avec les privilèges nécessaires pour bypass RLS
✅ **ON DELETE CASCADE** - Si un utilisateur est supprimé, ses settings sont automatiquement supprimés

## Architecture finale

```
┌─────────────────────────────────────────────────────────┐
│ User s'inscrit via /login                                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Supabase Auth crée l'utilisateur dans auth.users        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Trigger on_auth_user_created déclenché automatiquement  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Fonction create_default_settings() crée une ligne dans  │
│ public.settings avec user_id = auth.users.id            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ User redirigé vers /dashboard avec ses settings par     │
│ défaut déjà créés                                        │
└─────────────────────────────────────────────────────────┘
```

## Données créées automatiquement

Quand un utilisateur s'inscrit, une ligne est automatiquement créée dans `settings` :

```sql
{
  user_id: <uuid de l'utilisateur>,
  new_cards_per_day: 20,              -- Valeur par défaut
  max_reviews_per_day: 9999,          -- Valeur par défaut
  learning_mode: 'normal',            -- Valeur par défaut
  again_delay_minutes: 10,            -- Valeur par défaut
  review_order: 'mixed',              -- Valeur par défaut
  created_at: <timestamp>,
  updated_at: <timestamp>
}
```

## En cas de problème

Si l'erreur persiste après avoir appliqué le trigger :

1. Vérifiez que le trigger existe bien :
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

2. Vérifiez que la fonction existe :
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'create_default_settings';
   ```

3. Testez manuellement la création de settings pour un user existant :
   ```sql
   -- Récupérer l'ID d'un user existant
   SELECT id FROM auth.users LIMIT 1;

   -- Créer manuellement ses settings (remplacez <user_id>)
   INSERT INTO settings (user_id) VALUES ('<user_id>');
   ```

Si vous avez toujours des problèmes, partagez les logs d'erreur de Supabase.
