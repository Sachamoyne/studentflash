# Fix Auth Signup - Checklist

## 🎯 Problème
**Erreur:** "Database error saving new user"
**Cause:** Le trigger `on_auth_user_created` n'existe pas sur le serveur Supabase

---

## ✅ Solution (3 étapes, 2 minutes)

### 1. Exécuter le SQL dans Supabase

1. Ouvrir https://app.supabase.com
2. Sélectionner le projet **ANKIbis**
3. Aller dans **SQL Editor** (menu gauche)
4. Créer une **New query**
5. Copier-coller le contenu de `FIX_AUTH_SIGNUP.sql`
6. Cliquer **Run** (ou Cmd/Ctrl + Enter)

**Résultat attendu:**
```
Query completed successfully
1 row returned:
  trigger_name: on_auth_user_created
  enabled: O
  function_name: create_default_settings
```

### 2. Tester le signup

**Dans le navigateur:**
1. Aller sur http://localhost:3000/login
2. Cliquer sur "Don't have an account? Sign up"
3. Entrer un email et mot de passe
4. Cliquer "Sign up"

**Résultat attendu:**
- ✅ Pas d'erreur
- ✅ Redirection vers `/dashboard`

**OU via script de test:**
```bash
node diagnose-auth.js
```

**Résultat attendu:**
```
✅ Signup réussi!
✅ Settings créé automatiquement
✅ Tout fonctionne correctement!
```

### 3. Vérifier dans le dashboard Supabase

1. Aller dans **Table Editor**
2. Ouvrir la table **settings**
3. Vérifier qu'une nouvelle ligne existe avec votre `user_id`

---

## 🔍 En cas de problème persistant

Si l'erreur persiste après avoir exécuté le SQL:

**Vérifier les permissions de la fonction:**
```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'create_default_settings';
```
La colonne `prosecdef` doit être `true`.

**Vérifier que RLS permet l'insertion:**
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'settings' AND cmd = 'INSERT';
```
Il doit y avoir une policy "Users can create their own settings".

**Tester manuellement la création de settings:**
```sql
-- Créer un test user dans auth (via l'UI Supabase)
-- Puis tester l'insertion manuelle:
INSERT INTO settings (user_id)
VALUES ('PASTE-USER-ID-HERE');
```
Si ça échoue, c'est un problème de RLS.

---

## 🎉 C'est résolu quand:

✅ Le signup ne génère plus d'erreur
✅ Un user peut se créer un compte et accéder au dashboard
✅ Une ligne apparaît automatiquement dans `settings` pour chaque nouveau user
