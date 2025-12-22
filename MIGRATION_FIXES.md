# Modifications Next.js - Migration Dexie → Supabase

## Fichiers modifiés automatiquement

✅ `src/store/decks.ts` - Remplacé par version Supabase
✅ `src/lib/db.ts` - Remplacé par réexport de types Supabase

## Fichiers à corriger manuellement

### 1. src/app/(app)/dashboard/page.tsx

**Problèmes:**
- Ligne 13: `import { db } from "@/lib/db"` → `db` n'existe plus
- Ligne 14: `import { seedDatabase } from "@/lib/seed"` → Fonction de seed à supprimer
- Ligne 54: `await seedDatabase()` → À supprimer
- Ligne 56: `const allCards = await db.cards.toArray()` → Remplacer par fonction Supabase

**Fix:**
```typescript
// SUPPRIMER ces lignes:
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

// AJOUTER:
import { listCards } from "@/store/decks";

// Dans useEffect, REMPLACER:
await seedDatabase();  // ← SUPPRIMER
const allCards = await db.cards.toArray();  // ← SUPPRIMER

// PAR:
const decks = await listDecks();
let totalCards = 0;
for (const deck of decks) {
  const cards = await listCards(deck.id);
  totalCards += cards.length;
}
setCardCount(totalCards);
```

### 2. src/app/(app)/decks/page.tsx

**Ligne 17:** `import { db } from "@/lib/db"`

**Fix:** SUPPRIMER cette ligne (pas utilisée dans le fichier)

### 3. src/app/(app)/decks/[deckId]/page.tsx

**Ligne 35:** `import { db } from "@/lib/db"`

**Fix:** SUPPRIMER cette ligne (pas utilisée dans le fichier)

### 4. src/components/StudyCard.tsx

**Ligne 27:** `import { db } from "@/lib/db"`

**Fix:** SUPPRIMER cette ligne (pas utilisée dans le fichier)

### 5. src/components/ImportDialog.tsx

**Ligne 20:** `import { db } from "@/lib/db"`

**Fix:** SUPPRIMER cette ligne (pas utilisée dans le fichier)

### 6. src/app/(app)/study/[deckId]/page.tsx

**Ligne 7:** `import { db } from "@/lib/db"`

**Fix:** SUPPRIMER cette ligne (pas utilisée dans le fichier)

### 7. src/components/DeckTree.tsx

**Ligne 17:** `import { db } from "@/lib/db"`

**Fix:** SUPPRIMER cette ligne (pas utilisée dans le fichier)

### 8. src/lib/stats.ts

**Vérifier si `db` est utilisé et remplacer par fonctions Supabase**

### 9. src/store/settings.ts

**Ligne 1:** `import { db, type Settings } from "@/lib/db"`

**Fix:**
```typescript
// REMPLACER:
import { db, type Settings } from "@/lib/db";

// PAR:
import type { Settings } from "@/lib/db";
import { getSettings as getSettingsSupabase, updateSettings as updateSettingsSupabase } from "@/lib/supabase-db";

// Puis adapter toutes les fonctions pour utiliser Supabase au lieu de Dexie
```

### 10. Supprimer le fichier de seed

**Si existe:** `src/lib/seed.ts` → SUPPRIMER (ou désactiver)

Ce fichier crée des données de test qui sont partagées entre utilisateurs.

## Résumé des changements

| Fichier | Action |
|---------|--------|
| `src/store/decks.ts` | ✅ Remplacé |
| `src/lib/db.ts` | ✅ Remplacé |
| `src/app/(app)/dashboard/page.tsx` | ⚠️  Corriger lignes 13, 14, 54, 56 |
| `src/app/(app)/decks/page.tsx` | ⚠️  Supprimer ligne 17 |
| `src/app/(app)/decks/[deckId]/page.tsx` | ⚠️  Supprimer ligne 35 |
| `src/components/StudyCard.tsx` | ⚠️  Supprimer ligne 27 |
| `src/components/ImportDialog.tsx` | ⚠️  Supprimer ligne 20 |
| `src/app/(app)/study/[deckId]/page.tsx` | ⚠️  Supprimer ligne 7 |
| `src/components/DeckTree.tsx` | ⚠️  Supprimer ligne 17 |
| `src/store/settings.ts` | ⚠️  Migrer vers Supabase |
| `src/lib/stats.ts` | ⚠️  Vérifier et corriger |
| `src/lib/seed.ts` | ⚠️  Supprimer |
