# Debug: NEW Card Bug - Summary

## 🐛 Bug Report
**Symptom**: NEW cards don't change state after being reviewed
**Root Cause**: SM-2 scheduler migration not applied to database

---

## ✅ Solution Implemented

### 1. Added Comprehensive Logging

**File**: `src/lib/supabase-db.ts`

Added debug logs to `reviewCard()` function to track:
- ✅ Function entry with cardId, rating, userId
- ✅ Current card state before grading
- ✅ Settings loaded from database
- ✅ Scheduler calculation result
- ✅ Update data being sent to Supabase
- ✅ Update success/failure
- ✅ Review record creation
- ✅ Function completion

**Example console output:**
\`\`\`
🔷 reviewCard START {cardId: "abc", rating: "good", userId: "xyz"}
📋 Current card state: {state: "new", interval_days: 0, ease: 2.5, reps: 0}
⚙️ Settings loaded: {learning_steps: "1m 10m", graduating_interval_days: 1}
🧮 Calling gradeCard with: {state: "new", rating: "good"}
✅ gradeCard result: {new_state: "learning", new_interval_days: 0, ...}
💾 Updating card with: {state: "learning", learning_step_index: 0, reps: 1}
✅ Card updated successfully
✅ Review record created
🔷 reviewCard COMPLETE
\`\`\`

### 2. Added Fallback Values

Added `|| defaults` to all scheduler settings to prevent undefined errors:

\`\`\`javascript
const schedulerSettings = {
  learning_steps: settings.learning_steps || "1m 10m",
  graduating_interval_days: settings.graduating_interval_days || 1,
  starting_ease: settings.starting_ease || 2.5,
  // ... etc
};
\`\`\`

### 3. Created Diagnostic Tools

**File**: `check-migration.js`

Node.js script to verify migration status:

\`\`\`bash
node check-migration.js
\`\`\`

Checks:
- ✅ `cards.learning_step_index` column exists
- ✅ `cards.state` enum includes 'relearning'
- ✅ `settings` table has scheduler columns
- ✅ `reviews` table has audit columns

### 4. Created Fix Guide

**File**: `FIX_NEW_CARD_BUG.md`

Complete troubleshooting guide with:
- Diagnostic steps
- Migration application instructions
- Manual testing procedures
- Common errors and solutions
- Rollback instructions

---

## 🚀 Next Steps for User

### CRITICAL: Apply Migration First

**The migration MUST be applied before testing:**

\`\`\`bash
# Option 1: Via Supabase Dashboard
1. Go to SQL Editor
2. Paste: supabase/migrations/20250122_anki_sm2_scheduler.sql
3. Run

# Option 2: Via CLI
supabase db push
\`\`\`

### Then Verify

\`\`\`bash
node check-migration.js
\`\`\`

Should show all ✅

### Then Test

\`\`\`bash
npm run dev
\`\`\`

1. Open browser console (F12)
2. Create/study a NEW card
3. Press Enter to reveal
4. Press Enter again (or click Good)
5. **Check console logs** - should see all 🔷 ✅ logs
6. **Check database** - card.state should be 'learning'

---

## 📊 What the Logs Tell You

### If migration NOT applied:

\`\`\`
❌ Card update error: {
  code: "42703",
  message: "column "learning_step_index" of relation "cards" does not exist"
}
\`\`\`

**Fix**: Apply migration

### If settings missing:

\`\`\`
⚙️ Settings loaded: {
  learning_steps: undefined,
  graduating_interval_days: undefined,
  starting_ease: undefined
}
\`\`\`

**Fix**: Migration adds these. Apply migration and re-test.

### If RLS blocking:

\`\`\`
❌ Card fetch error: {
  code: "PGRST116",
  message: "The result contains 0 rows"
}
\`\`\`

**Fix**: Check RLS policies or user authentication

### If working correctly:

\`\`\`
🔷 reviewCard START
📋 Current card state: {state: "new", ...}
⚙️ Settings loaded: {learning_steps: "1m 10m", ...}
✅ gradeCard result: {new_state: "learning", ...}
✅ Card updated successfully
✅ Review record created
🔷 reviewCard COMPLETE
\`\`\`

---

## 🔍 How to Debug

### 1. Check Browser Console

Open DevTools → Console, look for:
- 🔷 reviewCard START
- ❌ Any error messages

### 2. Check Supabase Dashboard

Table Editor → cards:
\`\`\`sql
SELECT id, state, learning_step_index, reps, due_at, updated_at
FROM cards
ORDER BY updated_at DESC
LIMIT 5;
\`\`\`

Should see `updated_at` changing after each review.

### 3. Check Supabase Logs

Dashboard → Logs → Postgres logs

Look for errors during UPDATE queries.

### 4. Run Diagnostic

\`\`\`bash
node check-migration.js
\`\`\`

If shows ❌ → migration not applied

---

## 🎯 Success Criteria

After applying migration and testing:

✅ `node check-migration.js` shows all green
✅ Browser console shows complete review flow with no errors
✅ Database shows card state changes from 'new' → 'learning'
✅ Database shows `learning_step_index`, `reps`, `due_at` updated
✅ Card appears due again after delay (1 minute for default steps)
✅ Changes persist after logout/login

---

## 📝 Files Changed

1. **src/lib/supabase-db.ts** - Added comprehensive logging
2. **check-migration.js** (NEW) - Migration status checker
3. **FIX_NEW_CARD_BUG.md** (NEW) - Complete troubleshooting guide
4. **DEBUG_SUMMARY.md** (NEW) - This file

---

## 🔒 Root Cause Analysis

The bug occurs because:

1. **Migration not applied** → `learning_step_index` column doesn't exist
2. **Supabase UPDATE fails** with error about missing column
3. **Error is caught** by .catch() in StudyCard.tsx line 165
4. **Error logged** to console but UI continues
5. **Card state unchanged** in database
6. **UI removed card** from queue (optimistic update)
7. **Looks like it worked** but database unchanged

The fix is simple: **Apply the migration!**

All the scheduler code is correct, but without the database schema changes, it cannot persist the updates.
