/**
 * Check if the SM-2 scheduler migration has been applied
 * Run with: node check-migration.js
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigration() {
  console.log("🔍 Checking SM-2 Scheduler Migration Status...\n");

  // Check cards table
  console.log("📋 Checking cards table...");
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, state, learning_step_index, ease, interval_days, reps")
    .limit(1);

  if (cardsError) {
    if (cardsError.message.includes("learning_step_index")) {
      console.error("❌ MIGRATION NOT APPLIED: learning_step_index column missing!");
      console.log("\n⚠️  Please apply the migration:");
      console.log("   1. Open Supabase Dashboard → SQL Editor");
      console.log("   2. Run: supabase/migrations/20250122_anki_sm2_scheduler.sql\n");
      return false;
    }
    console.error("❌ Error querying cards:", cardsError.message);
    return false;
  }

  console.log("✅ cards table has learning_step_index");

  // Check state enum includes 'relearning'
  const { data: stateCheck, error: stateError } = await supabase
    .from("cards")
    .select("state")
    .eq("state", "relearning")
    .limit(1);

  if (stateError && stateError.message.includes("invalid input value")) {
    console.error("❌ MIGRATION NOT APPLIED: 'relearning' state not in enum!");
    return false;
  }

  console.log("✅ cards.state includes 'relearning'");

  // Check settings table
  console.log("\n⚙️  Checking settings table...");
  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("learning_steps, graduating_interval_days, starting_ease")
    .limit(1);

  if (settingsError) {
    if (settingsError.message.includes("learning_steps")) {
      console.error("❌ MIGRATION NOT APPLIED: scheduler settings columns missing!");
      return false;
    }
    console.error("❌ Error querying settings:", settingsError.message);
    return false;
  }

  if (settings && settings.length > 0) {
    console.log("✅ settings table has scheduler columns");
    console.log("   Sample settings:", {
      learning_steps: settings[0].learning_steps,
      graduating_interval_days: settings[0].graduating_interval_days,
      starting_ease: settings[0].starting_ease,
    });
  } else {
    console.log("⚠️  No settings found (no users yet?)");
  }

  // Check reviews table
  console.log("\n📝 Checking reviews table...");
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("id, previous_state, new_interval, elapsed_ms")
    .limit(1);

  if (reviewsError) {
    if (reviewsError.message.includes("previous_state")) {
      console.error("❌ MIGRATION NOT APPLIED: review audit columns missing!");
      return false;
    }
    console.error("❌ Error querying reviews:", reviewsError.message);
    return false;
  }

  console.log("✅ reviews table has audit columns");

  console.log("\n✅ ✅ ✅ MIGRATION APPLIED SUCCESSFULLY! ✅ ✅ ✅\n");
  return true;
}

checkMigration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error("❌ Unexpected error:", err);
    process.exit(1);
  });
