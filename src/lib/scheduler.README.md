# Anki SM-2 Scheduler

## Vue d'ensemble

Ce module implémente l'algorithme SM-2 d'Anki de manière **strictement conforme** au comportement d'Anki Desktop (scheduler v2).

## Fichiers

- **`scheduler.ts`** - Implémentation pure de l'algorithme SM-2
- **`scheduler.test.ts`** - Suite de tests de conformité Anki
- **`supabase-db.ts`** - Intégration avec la base de données

## Utilisation de base

### 1. Grader une carte (fonction pure)

```typescript
import { gradeCard } from "@/lib/scheduler";

const card: Card = {
  state: "new",
  ease: 2.5,
  interval_days: 0,
  reps: 0,
  lapses: 0,
  learning_step_index: 0,
  // ...
};

const settings: SchedulerSettings = {
  learning_steps: "1m 10m",
  graduating_interval_days: 1,
  starting_ease: 2.5,
  // ... (voir DEFAULT_SETTINGS dans les tests)
};

const result = gradeCard(card, "good", settings);
// → { state: "learning", interval_days: 0, due_at: ..., ease: 2.5, ... }
```

### 2. Prévisualiser les intervalles

```typescript
import { previewIntervals } from "@/lib/scheduler";

const preview = previewIntervals(card, settings);
// → { again: "1m", good: "10m", easy: "4 jours", hard: undefined }
```

### 3. Réviser une carte (avec DB)

```typescript
import { reviewCard } from "@/lib/supabase-db";

await reviewCard(cardId, "good", elapsedMs);
// Met à jour la carte dans la DB et crée un enregistrement de révision
```

### 4. Obtenir les cartes dues

```typescript
import { getDueCards } from "@/lib/supabase-db";

const dueCards = await getDueCards(deckId, 50);
// Retourne jusqu'à 50 cartes dans l'ordre Anki :
// 1. Learning/Relearning (par due_at)
// 2. Review (par due_at)
// 3. New (par created_at, limité par quota)
```

## Tests

### Lancer les tests

```bash
# Mode watch (pendant le développement)
npm test

# Mode UI (interface graphique)
npm run test:ui

# Exécution unique (CI)
npm run test:run
```

### Couverture des tests

Les tests vérifient **tous** les comportements critiques d'Anki :

#### Transitions d'état
- ✅ NEW → LEARNING
- ✅ LEARNING → REVIEW (graduation)
- ✅ REVIEW → RELEARNING (lapse)
- ✅ RELEARNING → REVIEW

#### Algorithme SM-2
- ✅ Calcul des intervalles (Good, Hard, Easy, Again)
- ✅ Modifications de l'ease factor
- ✅ Limites ease (1.3 - 3.0)
- ✅ Anti-stagnation (interval +1 minimum)

#### Comportement des boutons
- ✅ Again ne doit PAS incrémenter reps
- ✅ Hard sur NEW = Good (pas de Hard button affiché)
- ✅ Easy sur NEW = skip learning
- ✅ Hard en learning = moyenne Again/Good au step 0

#### Learning steps
- ✅ Parsing ("1m 10m 1d" → [1, 10, 1440])
- ✅ Progression à travers les steps
- ✅ Retour au step 0 sur Again

#### Quotas et priorisation
- ✅ new_cards_per_day respecté
- ✅ Ordre : learning → review → new

## Architecture

### Fonctions pures (pas d'effets de bord)

```typescript
gradeCard(card, rating, settings, now?)
  → SchedulingResult

previewIntervals(card, settings)
  → IntervalPreview

parseSteps(stepsStr)
  → number[] // minutes

formatInterval(minutes)
  → string // "1m", "10 jours", etc.
```

### Fonctions avec DB (async)

```typescript
getDueCards(deckId, limit)
  → Promise<Card[]>

reviewCard(cardId, rating, elapsedMs?)
  → Promise<void>

getDueCount(deckId)
  → Promise<number>

getDeckCardCounts(deckId)
  → Promise<{ new, learning, review }>
```

## États détaillés

### NEW
```typescript
{
  state: "new",
  due_at: "2025-01-22T10:00:00Z",
  interval_days: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  learning_step_index: 0
}
```

### LEARNING (step 0 sur "1m 10m")
```typescript
{
  state: "learning",
  due_at: "2025-01-22T10:01:00Z", // +1 minute
  interval_days: 0,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  learning_step_index: 0
}
```

### LEARNING (step 1)
```typescript
{
  state: "learning",
  due_at: "2025-01-22T10:11:00Z", // +10 minutes depuis la réponse
  interval_days: 0,
  ease: 2.5,
  reps: 2,
  lapses: 0,
  learning_step_index: 1
}
```

### REVIEW (après graduation)
```typescript
{
  state: "review",
  due_at: "2025-01-23T04:00:00Z", // +1 jour à 4h00
  interval_days: 1,
  ease: 2.5,
  reps: 3,
  lapses: 0,
  learning_step_index: 0
}
```

### REVIEW (après Good)
```typescript
{
  state: "review",
  due_at: "2025-01-25T04:00:00Z", // +2.5 jours (1 * 2.5)
  interval_days: 3, // arrondi
  ease: 2.5,
  reps: 4,
  lapses: 0,
  learning_step_index: 0
}
```

### RELEARNING (après Again en review)
```typescript
{
  state: "relearning",
  due_at: "2025-01-22T10:10:00Z", // +10m (relearning_steps)
  interval_days: 1, // préservé pour après relearning
  ease: 2.3, // -0.2
  reps: 5,
  lapses: 1, // +1
  learning_step_index: 0
}
```

## Formules SM-2

### Review - Good
```
new_interval = interval × ease × interval_modifier
new_ease = ease (inchangé)
```

### Review - Easy
```
new_interval = interval × ease × easy_bonus × interval_modifier
new_ease = ease + 0.15
```

### Review - Hard
```
new_interval = interval × hard_interval × interval_modifier
new_ease = ease - 0.15
```

### Review - Again
```
new_interval = interval × new_interval_multiplier (puis max avec minimum_interval_days)
new_ease = ease - 0.20
state = "relearning"
lapses += 1
```

### Anti-stagnation
```typescript
if (new_interval <= old_interval) {
  new_interval = old_interval + 1
}
```

### Limites
```typescript
ease = clamp(ease, 1.3, 3.0)
interval = clamp(interval, minimum_interval_days, maximum_interval_days)
```

## Configuration personnalisée

### Learning steps

```typescript
// Fast mode (2 steps)
learning_steps: "1m 10m"

// Normal mode (3 steps)
learning_steps: "1m 10m 1h"

// Deep mode (4+ steps)
learning_steps: "1m 10m 1h 1d"

// Custom
learning_steps: "5m 30m 2h 1d"
```

### Ease tuning

```typescript
// Plus facile (ease diminue moins vite)
easy_bonus: 1.4        // au lieu de 1.3
hard_interval: 1.3     // au lieu de 1.2

// Plus difficile (ease diminue plus vite)
easy_bonus: 1.2
hard_interval: 1.1
```

### Interval tuning

```typescript
// Intervalles plus courts (révisions plus fréquentes)
interval_modifier: 0.8

// Intervalles plus longs (révisions moins fréquentes)
interval_modifier: 1.2

// Nouveau interval après lapse (0% = minimum)
new_interval_multiplier: 0.0    // Reset complet
new_interval_multiplier: 0.5    // 50% de l'ancien interval
```

## Debugging

### Activer les logs

Les logs sont déjà présents dans `reviewCard()` :

```typescript
console.log("🔷 reviewCard START", { cardId, rating });
console.log("📋 Current card state:", { state, interval_days, ease });
console.log("🧮 Calling gradeCard");
console.log("✅ gradeCard result:", result);
console.log("💾 Updating card with:", updateData);
console.log("✅ Card updated successfully");
```

### Inspecter les intervalles

```typescript
const preview = previewIntervals(card, settings);
console.log(preview);
// → { again: "10m", hard: "12 jours", good: "25 jours", easy: "33 jours" }
```

### Tester un scénario

```typescript
import { gradeCard } from "@/lib/scheduler";

let card = createCard({ state: "new" });
console.log("Initial:", card);

card = { ...card, ...gradeCard(card, "good", DEFAULT_SETTINGS) };
console.log("After Good:", card);

card = { ...card, ...gradeCard(card, "good", DEFAULT_SETTINGS) };
console.log("After 2nd Good:", card);

card = { ...card, ...gradeCard(card, "again", DEFAULT_SETTINGS) };
console.log("After Again:", card);
```

## Troubleshooting

### Une carte reste en "new" après réponse
❌ **Bug** - Aucune carte ne doit rester en "new" après une réponse.

Vérifier :
1. La fonction `gradeCard()` retourne bien `state: "learning"` ou `"review"`
2. Le `reviewCard()` applique bien le résultat à la DB
3. Les RLS policies permettent l'update

### Les intervalles ne progressent pas
Vérifier :
1. `interval_modifier` n'est pas < 1.0
2. `ease` n'est pas au minimum (1.3)
3. L'anti-stagnation fonctionne (interval +1 minimum)

### Trop de new cards
Vérifier :
1. `new_cards_per_day` dans settings
2. La fonction `getDueCards()` compte correctement les cartes new d'aujourd'hui
3. La table `reviews` a bien `previous_state = "new"` enregistré

### Hard button apparaît sur new cards
❌ **Bug** - Le bouton Hard ne doit PAS être visible sur les new cards.

Vérifier :
1. `previewIntervals()` retourne `hard: undefined` pour state="new"
2. Le composant UI masque le bouton si `hard === undefined`

## Ressources

- **Documentation complète** : [ANKI_COMPLIANCE.md](../../ANKI_COMPLIANCE.md)
- **Tests** : [scheduler.test.ts](./scheduler.test.ts)
- **Anki manual** : https://docs.ankiweb.net/studying.html
- **SM-2 algorithm** : https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method

## Support

Pour toute question sur l'implémentation ou les tests :
1. Consulter [ANKI_COMPLIANCE.md](../../ANKI_COMPLIANCE.md)
2. Lancer les tests : `npm test`
3. Comparer avec le comportement Anki Desktop
