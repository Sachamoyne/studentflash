#!/usr/bin/env node

/**
 * Test manuel du scheduler Anki SM-2
 * Exécuter avec: node test-scheduler.mjs
 */

import { gradeCard, parseSteps, previewIntervals } from "./src/lib/scheduler.ts";

// Couleurs pour le terminal
const green = "\x1b[32m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const reset = "\x1b[0m";

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`${green}✓${reset} ${message}`);
    passedTests++;
  } else {
    console.log(`${red}✗${reset} ${message}`);
    failedTests++;
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

function testGroup(name) {
  console.log(`\n${blue}━━━ ${name} ━━━${reset}`);
}

// Settings par défaut Anki
const DEFAULT_SETTINGS = {
  learning_steps: "1m 10m",
  relearning_steps: "10m",
  graduating_interval_days: 1,
  easy_interval_days: 4,
  starting_ease: 2.5,
  easy_bonus: 1.3,
  hard_interval: 1.2,
  interval_modifier: 1.0,
  new_interval_multiplier: 0.0,
  minimum_interval_days: 1,
  maximum_interval_days: 36500,
  again_delay_minutes: 10,
};

// Helper pour créer une carte
function createCard(overrides = {}) {
  return {
    id: "test-id",
    user_id: "test-user",
    deck_id: "test-deck",
    front: "Front",
    back: "Back",
    state: "new",
    due_at: new Date().toISOString(),
    interval_days: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    suspended: false,
    learning_step_index: 0,
    last_reviewed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

testGroup("Parse Steps");

const steps1 = parseSteps("1m 10m");
assertEqual(steps1[0], 1, "Parse '1m'");
assertEqual(steps1[1], 10, "Parse '10m'");

const steps2 = parseSteps("1m 10m 1d");
assertEqual(steps2[2], 1440, "Parse '1d' = 1440 minutes");

const steps3 = parseSteps("1h 2h");
assertEqual(steps3[0], 60, "Parse '1h' = 60 minutes");

testGroup("NEW → LEARNING");

const newCard = createCard({ state: "new" });

const newGood = gradeCard(newCard, "good", DEFAULT_SETTINGS);
assertEqual(newGood.state, "learning", "NEW + Good → LEARNING");
assertEqual(newGood.learning_step_index, 0, "Start at step 0");
assertEqual(newGood.reps, 1, "Reps = 1");

const newEasy = gradeCard(newCard, "easy", DEFAULT_SETTINGS);
assertEqual(newEasy.state, "review", "NEW + Easy → REVIEW (skip learning)");
assertEqual(newEasy.interval_days, 4, "Easy interval = 4 days");

const newAgain = gradeCard(newCard, "again", DEFAULT_SETTINGS);
assertEqual(newAgain.state, "learning", "NEW + Again → LEARNING");
assertEqual(newAgain.reps, 0, "Again doesn't increment reps");

testGroup("LEARNING → REVIEW (Graduation)");

const learningCard = createCard({
  state: "learning",
  learning_step_index: 1, // Last step
  reps: 1,
});

const learningGood = gradeCard(learningCard, "good", DEFAULT_SETTINGS);
assertEqual(learningGood.state, "review", "LEARNING (last step) + Good → REVIEW");
assertEqual(learningGood.interval_days, 1, "Graduating interval = 1 day");

const learningEasy = gradeCard(learningCard, "easy", DEFAULT_SETTINGS);
assertEqual(learningEasy.state, "review", "LEARNING + Easy → REVIEW");
assertEqual(learningEasy.interval_days, 4, "Easy interval = 4 days");

testGroup("LEARNING Steps");

const learningStep0 = createCard({
  state: "learning",
  learning_step_index: 0,
  reps: 1,
});

const advanceStep = gradeCard(learningStep0, "good", DEFAULT_SETTINGS);
assertEqual(advanceStep.state, "learning", "Still in learning");
assertEqual(advanceStep.learning_step_index, 1, "Advanced to step 1");

const resetStep = gradeCard(learningStep0, "again", DEFAULT_SETTINGS);
assertEqual(resetStep.learning_step_index, 0, "Again resets to step 0");

testGroup("REVIEW - SM-2 Algorithm");

const reviewCard = createCard({
  state: "review",
  interval_days: 10,
  ease: 2.5,
  reps: 5,
});

const reviewGood = gradeCard(reviewCard, "good", DEFAULT_SETTINGS);
assertEqual(reviewGood.state, "review", "Still in review");
assertEqual(reviewGood.interval_days, 25, "Interval = 10 × 2.5 = 25");
assertEqual(reviewGood.ease, 2.5, "Ease unchanged");

const reviewEasy = gradeCard(reviewCard, "easy", DEFAULT_SETTINGS);
assertEqual(reviewEasy.interval_days, 33, "Interval = 10 × 2.5 × 1.3 ≈ 33");
assert(Math.abs(reviewEasy.ease - 2.65) < 0.01, "Ease = 2.5 + 0.15 = 2.65");

const reviewHard = gradeCard(reviewCard, "hard", DEFAULT_SETTINGS);
assertEqual(reviewHard.interval_days, 12, "Interval = 10 × 1.2 = 12");
assert(Math.abs(reviewHard.ease - 2.35) < 0.01, "Ease = 2.5 - 0.15 = 2.35");

const reviewAgain = gradeCard(reviewCard, "again", DEFAULT_SETTINGS);
assertEqual(reviewAgain.state, "relearning", "REVIEW + Again → RELEARNING");
assert(Math.abs(reviewAgain.ease - 2.3) < 0.01, "Ease = 2.5 - 0.2 = 2.3");
assertEqual(reviewAgain.lapses, 1, "Lapses incremented");

testGroup("Ease Factor Limits");

const lowEaseCard = createCard({
  state: "review",
  interval_days: 10,
  ease: 1.4,
  reps: 5,
});

const lowEaseAgain = gradeCard(lowEaseCard, "again", DEFAULT_SETTINGS);
assert(lowEaseAgain.ease >= 1.3, "Ease doesn't go below 1.3");

const highEaseCard = createCard({
  state: "review",
  interval_days: 10,
  ease: 2.9,
  reps: 5,
});

const highEaseEasy = gradeCard(highEaseCard, "easy", DEFAULT_SETTINGS);
assert(highEaseEasy.ease <= 3.0, "Ease doesn't go above 3.0");

testGroup("RELEARNING → REVIEW");

const relearnCard = createCard({
  state: "relearning",
  interval_days: 5,
  ease: 2.3,
  learning_step_index: 0,
  reps: 6,
  lapses: 1,
});

const relearnGood = gradeCard(relearnCard, "good", DEFAULT_SETTINGS);
assertEqual(relearnGood.state, "review", "RELEARNING + Good → REVIEW");
assertEqual(relearnGood.interval_days, 1, "Back to minimum interval");

const relearnAgain = gradeCard(relearnCard, "again", DEFAULT_SETTINGS);
assertEqual(relearnAgain.state, "relearning", "Still in relearning");
assertEqual(relearnAgain.learning_step_index, 0, "Reset to step 0");

testGroup("Preview Intervals");

const newCardPreview = createCard({ state: "new" });
const newPreview = previewIntervals(newCardPreview, DEFAULT_SETTINGS);

assertEqual(newPreview.hard, undefined, "No hard button on NEW cards");
assert(newPreview.again !== undefined, "Again button exists");
assert(newPreview.good !== undefined, "Good button exists");
assert(newPreview.easy !== undefined, "Easy button exists");

testGroup("Comprehensive Flow");

let flowCard = createCard({ state: "new" });

// NEW → LEARNING
flowCard = { ...flowCard, ...gradeCard(flowCard, "good", DEFAULT_SETTINGS) };
assertEqual(flowCard.state, "learning", "Step 1: NEW → LEARNING");

// LEARNING step 0 → LEARNING step 1
flowCard = { ...flowCard, ...gradeCard(flowCard, "good", DEFAULT_SETTINGS) };
assertEqual(flowCard.state, "learning", "Step 2: Still LEARNING");
assertEqual(flowCard.learning_step_index, 1, "Step 2: At step 1");

// LEARNING step 1 → REVIEW
flowCard = { ...flowCard, ...gradeCard(flowCard, "good", DEFAULT_SETTINGS) };
assertEqual(flowCard.state, "review", "Step 3: LEARNING → REVIEW");
assertEqual(flowCard.interval_days, 1, "Step 3: 1 day interval");

// REVIEW → REVIEW (interval grows)
const oldInterval = flowCard.interval_days;
flowCard = { ...flowCard, ...gradeCard(flowCard, "good", DEFAULT_SETTINGS) };
assertEqual(flowCard.state, "review", "Step 4: Still REVIEW");
assert(flowCard.interval_days > oldInterval, "Step 4: Interval increased");

testGroup("Critical: Card never stays in NEW");

const criticalNew = createCard({ state: "new" });

assert(gradeCard(criticalNew, "again", DEFAULT_SETTINGS).state !== "new", "Again: leaves NEW");
assert(gradeCard(criticalNew, "good", DEFAULT_SETTINGS).state !== "new", "Good: leaves NEW");
assert(gradeCard(criticalNew, "easy", DEFAULT_SETTINGS).state !== "new", "Easy: leaves NEW");
assert(gradeCard(criticalNew, "hard", DEFAULT_SETTINGS).state !== "new", "Hard: leaves NEW");

testGroup("Anti-Stagnation");

const stagnantCard = createCard({
  state: "review",
  interval_days: 100,
  ease: 1.3,
  reps: 10,
});

const stagnantSettings = {
  ...DEFAULT_SETTINGS,
  hard_interval: 1.0, // Would normally keep interval same
};

const antiStagnant = gradeCard(stagnantCard, "hard", stagnantSettings);
assert(antiStagnant.interval_days > 100, "Interval must increase by at least 1");

// ============================================================================
// RÉSULTATS
// ============================================================================

console.log(`\n${yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
console.log(`${blue}RÉSULTATS${reset}`);
console.log(`${yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
console.log(`${green}✓ Tests réussis: ${passedTests}${reset}`);
console.log(`${red}✗ Tests échoués: ${failedTests}${reset}`);
console.log(`${yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

if (failedTests === 0) {
  console.log(`${green}🎉 Tous les tests sont passés ! Le scheduler est conforme à Anki SM-2.${reset}\n`);
  process.exit(0);
} else {
  console.log(`${red}❌ Certains tests ont échoué. Vérifiez l'implémentation.${reset}\n`);
  process.exit(1);
}
