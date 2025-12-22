# Anki SM-2 Scheduler Implementation

## Overview

This document describes the implementation of the Anki SM-2 spaced repetition scheduler in the Next.js + Supabase app.

**Algorithm**: Legacy Anki / SM-2 modified (NOT FSRS)

## Files Modified

### 1. Database Schema

**File**: `supabase/migrations/20250122_anki_sm2_scheduler.sql`

**Changes**:
- Added `relearning` state to `cards.state` enum
- Added `cards.learning_step_index` (INTEGER) to track position in learning/relearning steps
- Extended `reviews` table with:
  - `elapsed_ms` - Time taken to answer
  - `previous_state` - Card state before review
  - `previous_interval` - Interval before review
  - `new_interval` - Interval after review
  - `new_due_at` - Due date after review

- Added scheduler settings to `settings` table:
  - `learning_steps` (TEXT, default '1m 10m')
  - `relearning_steps` (TEXT, default '10m')
  - `graduating_interval_days` (INTEGER, default 1)
  - `easy_interval_days` (INTEGER, default 4)
  - `starting_ease` (DECIMAL, default 2.50)
  - `easy_bonus` (DECIMAL, default 1.30)
  - `hard_interval` (DECIMAL, default 1.20)
  - `interval_modifier` (DECIMAL, default 1.00)
  - `new_interval_multiplier` (DECIMAL, default 0.00)
  - `minimum_interval_days` (INTEGER, default 1)
  - `maximum_interval_days` (INTEGER, default 36500)

### 2. Core Scheduler Logic

**File**: `src/lib/scheduler.ts`

**Exports**:
- `parseSteps(stepsStr: string): number[]` - Parse learning steps string into minutes
- `gradeCard(card, rating, settings, now): SchedulingResult` - Main scheduling function
- `previewIntervals(card, settings): IntervalPreview` - Preview intervals for UI
- `formatInterval(minutes)` - Format interval for display
- `formatIntervalDays(days)` - Format days for display

**Algorithm Details**:

#### New Cards
- **Again**: Go to first learning step
- **Hard**: Same as Good for new cards (Anki behavior)
- **Good**: Go to first learning step
- **Easy**: Skip learning, graduate immediately to review with easy_interval_days

#### Learning Cards
- **Again**: Back to first learning step
- **Hard**:
  - On first step: Average of Again step and Good (next) step
  - On other steps: Repeat current step
  - Special case for single step: 1.5x step (capped at +1 day)
- **Good**: Advance to next step, or graduate if last step
- **Easy**: Graduate immediately to review with easy_interval_days

#### Review Cards
- **Again**:
  - ease -= 0.20
  - lapses += 1
  - interval *= new_interval_multiplier
  - Enter relearning state (or min interval if no relearning steps)
- **Hard**:
  - ease -= 0.15
  - interval *= hard_interval
- **Good**:
  - interval *= ease
- **Easy**:
  - ease += 0.15
  - interval *= ease * easy_bonus

For Hard/Good/Easy: interval *= interval_modifier

Bounds:
- ease: 1.3 - 3.0
- interval: minimum_interval_days - maximum_interval_days
- Anti-stagnation: new interval >= old interval + 1 day

#### Relearning Cards
- **Again**: Back to first relearning step
- **Hard**: Repeat current step
- **Good**: Advance to next step, or back to review with min interval
- **Easy**: Back to review immediately with min interval

#### Interday Steps
Steps >= 1 day (1440 minutes) are scheduled to tomorrow at 4am instead of exact time.

### 3. Database Integration

**File**: `src/lib/supabase-db.ts`

**Changes**:
- Rewrote `reviewCard()` to use new scheduler
- Added `elapsedMs` parameter (optional)
- Now stores detailed review log with all state transitions
- Re-exports scheduler functions for convenience

### 4. UI Updates

**File**: `src/components/StudyCard.tsx`

**Changes**:
- Added interval preview calculation
- Display intervals on each button (Again/Hard/Good/Easy)
- Shows human-readable intervals (e.g., "10m", "1 jour", "3 mois")
- Previews calculated when answer is shown

## Configuration

All scheduler settings are stored per-user in the `settings` table with Anki default values:

```typescript
{
  learning_steps: '1m 10m',           // Learning steps for new cards
  relearning_steps: '10m',            // Relearning steps for lapsed cards
  graduating_interval_days: 1,        // Interval when graduating
  easy_interval_days: 4,              // Interval for Easy on new cards
  starting_ease: 2.50,                // Starting ease factor (250%)
  easy_bonus: 1.30,                   // Easy multiplier on review cards
  hard_interval: 1.20,                // Hard multiplier on review cards
  interval_modifier: 1.00,            // Global interval modifier (100%)
  new_interval_multiplier: 0.00,      // Multiplier when lapsing (0% = minimum)
  minimum_interval_days: 1,           // Minimum interval for graduated cards
  maximum_interval_days: 36500,       // Maximum interval (100 years)
}
```

## Testing Scenarios

### Scenario 1: New Card → Graduation

1. Create a new card
2. Start study session
3. Press "Good" (should show "1m")
4. Wait 1 minute, press "Good" again (should show "10m")
5. Wait 10 minutes, press "Good" again (should graduate to review with 1 day interval)

Expected: Card state = "review", interval_days = 1, due_at = tomorrow at 4am

### Scenario 2: Review Card → Again → Relearning

1. Have a review card with interval = 7 days, ease = 2.5
2. Press "Again"
3. Expected: state = "relearning", ease = 2.3, lapses = 1
4. Follow relearning steps (default "10m")
5. Press "Good" after 10m
6. Expected: Back to review with minimum_interval_days = 1

### Scenario 3: Multi-User Isolation

1. Create cards for User A and User B
2. Review cards for User A
3. Verify User B's cards are unchanged
4. Verify RLS policies prevent cross-user access

## Migration Instructions

### 1. Apply SQL Migration

```bash
# If using Supabase CLI
supabase migration new anki_sm2_scheduler
# Copy contents of supabase/migrations/20250122_anki_sm2_scheduler.sql
supabase db push

# Or apply directly via Supabase dashboard SQL editor
```

### 2. Verify Migration

```sql
-- Check cards table has new fields
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name IN ('learning_step_index');

-- Check settings table has new fields
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'settings'
AND column_name LIKE '%interval%';

-- Check reviews table extensions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reviews'
AND column_name IN ('elapsed_ms', 'previous_state', 'new_interval');
```

### 3. Test Locally

```bash
npm run dev
```

1. Sign in / create account
2. Create a test deck with a few cards
3. Study cards and verify intervals appear on buttons
4. Check database to verify state transitions

### 4. Monitor

Watch for:
- Cards graduating correctly from learning to review
- Intervals increasing properly with Good/Easy
- Lapses triggering relearning correctly
- Ease factors adjusting within bounds (1.3 - 3.0)

## Known Limitations

1. **No FSRS**: This is the legacy SM-2 algorithm, not the newer FSRS algorithm
2. **Fixed review time**: All reviews scheduled for 4am (not configurable yet)
3. **No fuzz**: Intervals are exact, no randomization to spread load
4. **No sibling card handling**: If a note has multiple cards, they're independent

## Future Enhancements

- [ ] Configurable review time (instead of hardcoded 4am)
- [ ] Interval fuzzing to spread reviews
- [ ] Per-deck settings (currently global per-user)
- [ ] FSRS algorithm option
- [ ] Load balancing (cap daily reviews)
- [ ] Bury related cards
- [ ] Custom scheduling presets

## References

- [Anki Manual - Deck Options](https://docs.ankiweb.net/deck-options.html)
- [SuperMemo SM-2 Algorithm](https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method)
- [Anki Source Code](https://github.com/ankitects/anki)
