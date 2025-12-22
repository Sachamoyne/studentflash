# Fix: NEW Cards Not Changing State

## Problem
NEW cards stay in 'new' state after being reviewed. They don't transition to 'learning' or 'review'.

## Root Cause
**The SM-2 scheduler migration has not been applied to the database.**

The migration adds critical fields like:
- `cards.learning_step_index`
- `settings.learning_steps` and 10 other scheduler settings
- `reviews` audit columns

Without these fields, the update fails silently.

---

## Diagnostic Steps

### 1. Check if migration is applied

```bash
node check-migration.js
```

**Expected output if NOT applied:**
```
❌ MIGRATION NOT APPLIED: learning_step_index column missing!
```

**Expected output if applied:**
```
✅ cards table has learning_step_index
✅ cards.state includes 'relearning'
✅ settings table has scheduler columns
✅ reviews table has audit columns
✅ ✅ ✅ MIGRATION APPLIED SUCCESSFULLY! ✅ ✅ ✅
```

### 2. Check browser console

Start the app and try to review a NEW card:

```bash
npm run dev
```

Open browser console (F12), you should see:
```
🔷 reviewCard START {cardId: "...", rating: "good", userId: "..."}
📋 Current card state: {state: "new", interval_days: 0, ...}
⚙️ Settings loaded: {learning_steps: "1m 10m", ...}
🧮 Calling gradeCard with: {state: "new", rating: "good"}
✅ gradeCard result: {new_state: "learning", new_interval_days: 0, ...}
💾 Updating card with: {state: "learning", ...}
```

**If you see an error like:**
```
❌ Card update error: column "learning_step_index" does not exist
```

→ **Migration not applied!**

---

## Fix: Apply the Migration

### Option A: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Open `supabase/migrations/20250122_anki_sm2_scheduler.sql`
5. Copy the entire content
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for "Success" message

### Option B: Supabase CLI

```bash
# Make sure you're in the project directory
cd /path/to/ANKIbis

# Push migration to Supabase
supabase db push
```

---

## Verification

### 1. Run diagnostic again

```bash
node check-migration.js
```

Should show all ✅

### 2. Check a sample card in database

Via Supabase Dashboard → Table Editor → cards:

```sql
SELECT id, state, learning_step_index, ease, interval_days, reps, due_at
FROM cards
LIMIT 5;
```

You should see the `learning_step_index` column.

### 3. Check settings

```sql
SELECT user_id, learning_steps, graduating_interval_days, starting_ease
FROM settings
LIMIT 5;
```

Should show values like:
- learning_steps: "1m 10m"
- graduating_interval_days: 1
- starting_ease: 2.50

---

## Manual Test

### Test 1: NEW → Learning

1. Create a new card
2. Start study session
3. Show answer (press Space or Enter)
4. Press Enter again (or click "Good")
5. **Check browser console** for logs

**Expected console output:**
```
🔷 reviewCard START {cardId: "abc-123", rating: "good", ...}
📋 Current card state: {state: "new", interval_days: 0, ease: 2.5, reps: 0}
✅ gradeCard result: {new_state: "learning", new_interval_days: 0, ...}
💾 Updating card with: {state: "learning", learning_step_index: 0, reps: 1, ...}
✅ Card updated successfully
✅ Review record created
🔷 reviewCard COMPLETE
```

6. **Check database** (Supabase Dashboard → Table Editor):

```sql
SELECT id, state, learning_step_index, reps, due_at
FROM cards
WHERE id = 'abc-123';  -- Replace with your card ID
```

**Expected result:**
- state: "learning"
- learning_step_index: 0
- reps: 1
- due_at: ~1 minute from now (for "1m 10m" steps)

### Test 2: Learning → Next Step

1. Wait 1 minute (or change `due_at` to past)
2. Study the card again
3. Press "Good"

**Expected:**
- state: "learning"
- learning_step_index: 1
- due_at: ~10 minutes from now

### Test 3: Learning → Graduation

1. Wait 10 minutes
2. Study the card again
3. Press "Good"

**Expected:**
- state: "review"
- learning_step_index: 0
- interval_days: 1
- due_at: tomorrow at 4am

---

## Common Errors

### Error: "column learning_step_index does not exist"

**Cause:** Migration not applied

**Fix:** Apply migration (see above)

### Error: "invalid input value for enum cards_state_check"

**Cause:** 'relearning' state not added to enum

**Fix:** Migration includes this. Re-apply migration.

### Error: "null value in column learning_steps violates not-null constraint"

**Cause:** Settings row exists without new columns

**Fix:** Migration includes UPDATE to set defaults. Delete and re-insert settings row:

```sql
DELETE FROM settings WHERE user_id = 'your-user-id';
-- Trigger will recreate with defaults
```

### No console logs appearing

**Cause:** Console not open, or logs filtered

**Fix:**
1. Open DevTools (F12)
2. Go to Console tab
3. Make sure no filters are active
4. Try again

---

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Remove new columns from cards
ALTER TABLE cards DROP COLUMN IF EXISTS learning_step_index;
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_state_check;
ALTER TABLE cards ADD CONSTRAINT cards_state_check
  CHECK (state IN ('new', 'learning', 'review'));

-- Remove new columns from reviews
ALTER TABLE reviews DROP COLUMN IF EXISTS elapsed_ms;
ALTER TABLE reviews DROP COLUMN IF EXISTS previous_state;
ALTER TABLE reviews DROP COLUMN IF EXISTS previous_interval;
ALTER TABLE reviews DROP COLUMN IF EXISTS new_interval;
ALTER TABLE reviews DROP COLUMN IF EXISTS new_due_at;

-- Remove new columns from settings
ALTER TABLE settings DROP COLUMN IF EXISTS learning_steps;
ALTER TABLE settings DROP COLUMN IF EXISTS relearning_steps;
ALTER TABLE settings DROP COLUMN IF EXISTS graduating_interval_days;
ALTER TABLE settings DROP COLUMN IF EXISTS easy_interval_days;
ALTER TABLE settings DROP COLUMN IF EXISTS starting_ease;
ALTER TABLE settings DROP COLUMN IF EXISTS easy_bonus;
ALTER TABLE settings DROP COLUMN IF EXISTS hard_interval;
ALTER TABLE settings DROP COLUMN IF EXISTS interval_modifier;
ALTER TABLE settings DROP COLUMN IF EXISTS new_interval_multiplier;
ALTER TABLE settings DROP COLUMN IF EXISTS minimum_interval_days;
ALTER TABLE settings DROP COLUMN IF EXISTS maximum_interval_days;
```

---

## Still Not Working?

1. **Check RLS policies:**

```sql
-- Verify user can update their own cards
SELECT * FROM cards WHERE id = 'your-card-id' AND user_id = auth.uid();

-- If returns nothing, RLS is blocking
-- Check policies:
SELECT * FROM pg_policies WHERE tablename = 'cards';
```

2. **Check Supabase logs:**
   - Go to Supabase Dashboard → Logs
   - Filter by "postgres" or "api"
   - Look for errors during card update

3. **Verify user authentication:**

```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);
```

4. **Open an issue** with:
   - Console logs
   - Database state before/after
   - Supabase error logs
   - Browser/OS version

---

## Success Criteria

✅ Migration applied successfully (check-migration.js passes)
✅ NEW card changes to 'learning' after first review
✅ Console shows all review steps completing
✅ Database shows updated state/due_at/learning_step_index
✅ Card progresses through learning steps correctly
✅ Card graduates to 'review' after final learning step
✅ Changes persist after logout/login
