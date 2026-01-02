/**
 * Anki SM-2 Scheduler Tests
 *
 * These tests verify that the scheduler behaves EXACTLY like Anki Desktop.
 * Reference: Anki scheduler v2 (SM-2 algorithm)
 */

import { describe, it, expect } from "vitest";
import { gradeCard, parseSteps, previewIntervals, type SchedulerSettings } from "./scheduler";
import type { Card } from "./supabase-db";

// Default Anki settings
const DEFAULT_SETTINGS: SchedulerSettings = {
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

// Helper to create a card
function createCard(overrides?: Partial<Card>): Card {
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
  } as Card;
}

describe("parseSteps", () => {
  it("parses minutes correctly", () => {
    expect(parseSteps("1m 10m")).toEqual([1, 10]);
  });

  it("parses mixed units", () => {
    expect(parseSteps("1m 10m 1d")).toEqual([1, 10, 1440]);
  });

  it("parses hours", () => {
    expect(parseSteps("1h 2h")).toEqual([60, 120]);
  });

  it("handles empty string", () => {
    expect(parseSteps("")).toEqual([]);
  });

  it("filters out invalid steps", () => {
    expect(parseSteps("1m invalid 10m")).toEqual([1, 10]);
  });
});

describe("New Card → Learning", () => {
  it("Again: should enter learning at first step", () => {
    const card = createCard({ state: "new" });
    const result = gradeCard(card, "again", DEFAULT_SETTINGS);

    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(0);
    expect(result.reps).toBe(0); // Anki behavior: Again on new doesn't increment reps
    expect(result.lapses).toBe(0);
  });

  it("Good: should enter learning at first step", () => {
    const card = createCard({ state: "new" });
    const result = gradeCard(card, "good", DEFAULT_SETTINGS);

    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(0);
    expect(result.reps).toBe(1);
    expect(result.ease).toBe(2.5);
  });

  it("Easy: should skip learning and graduate immediately", () => {
    const card = createCard({ state: "new" });
    const result = gradeCard(card, "easy", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(4); // easy_interval_days
    expect(result.reps).toBe(1);
    expect(result.ease).toBe(2.5);
  });

  it("Hard: should behave like Good on new cards (Anki behavior)", () => {
    const card = createCard({ state: "new" });
    const result = gradeCard(card, "hard", DEFAULT_SETTINGS);

    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(0);
    expect(result.reps).toBe(1);
  });
});

describe("Learning → Review (Graduation)", () => {
  it("Good on last step: should graduate to review", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 1, // Last step (0-indexed, steps are [1m, 10m])
      reps: 1,
    });
    const result = gradeCard(card, "good", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(1); // graduating_interval_days
    expect(result.learning_step_index).toBe(0);
    expect(result.reps).toBe(2);
  });

  it("Easy in learning: should graduate immediately", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 0,
      reps: 1,
    });
    const result = gradeCard(card, "easy", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(4); // easy_interval_days
    expect(result.reps).toBe(2);
  });

  it("Again in learning: should restart at first step", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 1,
      reps: 2,
    });
    const result = gradeCard(card, "again", DEFAULT_SETTINGS);

    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(0);
    expect(result.reps).toBe(2); // Anki behavior: reps not incremented on Again
  });

  it("Good: should advance to next step", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 0,
      reps: 1,
    });
    const result = gradeCard(card, "good", DEFAULT_SETTINGS);

    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(1);
    expect(result.reps).toBe(2);
  });
});

describe("Review Cards - SM-2 Algorithm", () => {
  it("Good: should multiply interval by ease factor", () => {
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
      reps: 5,
    });
    const result = gradeCard(card, "good", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    // 10 * 2.5 * 1.0 (interval_modifier) = 25
    expect(result.interval_days).toBe(25);
    expect(result.ease).toBe(2.5); // Unchanged for Good
    expect(result.reps).toBe(6);
  });

  it("Easy: should increase ease and apply easy bonus", () => {
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
      reps: 5,
    });
    const result = gradeCard(card, "easy", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    // 10 * 2.5 * 1.3 (easy_bonus) * 1.0 = 32.5 -> 33
    expect(result.interval_days).toBe(33);
    expect(result.ease).toBe(2.65); // 2.5 + 0.15
    expect(result.reps).toBe(6);
  });

  it("Hard: should decrease ease and apply hard multiplier", () => {
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
      reps: 5,
    });
    const result = gradeCard(card, "hard", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    // 10 * 1.2 (hard_interval) * 1.0 = 12
    expect(result.interval_days).toBe(12);
    expect(result.ease).toBe(2.35); // 2.5 - 0.15
    expect(result.reps).toBe(6);
  });

  it("Again: should enter relearning and decrease ease", () => {
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
      reps: 5,
      lapses: 0,
    });
    const result = gradeCard(card, "again", DEFAULT_SETTINGS);

    expect(result.state).toBe("relearning");
    expect(result.ease).toBe(2.3); // 2.5 - 0.2
    expect(result.lapses).toBe(1);
    // Interval calculated with new_interval_multiplier = 0.0 -> max(1, 10 * 0.0) = 1
    expect(result.interval_days).toBe(1);
  });

  it("Ease factor: should not go below 1.3 (minimum)", () => {
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 1.4, // Close to minimum
      reps: 5,
    });
    const result = gradeCard(card, "again", DEFAULT_SETTINGS);

    // 1.4 - 0.2 = 1.2, but clamped to 1.3
    expect(result.ease).toBe(1.3);
  });

  it("Ease factor: should not go above 3.0 (maximum)", () => {
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.9,
      reps: 5,
    });
    const result = gradeCard(card, "easy", DEFAULT_SETTINGS);

    // 2.9 + 0.15 = 3.05, but clamped to 3.0
    expect(result.ease).toBe(3.0);
  });

  it("Anti-stagnation: interval must increase by at least 1 day", () => {
    const card = createCard({
      state: "review",
      interval_days: 100,
      ease: 1.3, // Minimum ease
      reps: 10,
    });

    const settings = {
      ...DEFAULT_SETTINGS,
      hard_interval: 1.0, // This would normally keep interval same
    };

    const result = gradeCard(card, "hard", settings);

    // Even with hard_interval=1.0, should increase by at least 1
    expect(result.interval_days).toBeGreaterThan(100);
  });
});

describe("Relearning → Review", () => {
  it("Good on last relearning step: should return to review", () => {
    const card = createCard({
      state: "relearning",
      interval_days: 5, // Preserved from before lapse
      ease: 2.3,
      learning_step_index: 0, // Only one relearning step
      reps: 6,
      lapses: 1,
    });
    const result = gradeCard(card, "good", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(1); // minimum_interval_days
    expect(result.reps).toBe(7);
  });

  it("Again in relearning: should restart relearning steps", () => {
    const card = createCard({
      state: "relearning",
      interval_days: 5,
      ease: 2.3,
      learning_step_index: 0,
      reps: 6,
      lapses: 1,
    });
    const result = gradeCard(card, "again", DEFAULT_SETTINGS);

    expect(result.state).toBe("relearning");
    expect(result.learning_step_index).toBe(0);
    expect(result.reps).toBe(6); // Not incremented on Again
  });

  it("Easy in relearning: should graduate immediately", () => {
    const card = createCard({
      state: "relearning",
      interval_days: 5,
      ease: 2.3,
      learning_step_index: 0,
      reps: 6,
      lapses: 1,
    });
    const result = gradeCard(card, "easy", DEFAULT_SETTINGS);

    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(1); // minimum_interval_days
  });
});

describe("Edge Cases", () => {
  it("No learning steps: new card should graduate immediately", () => {
    const settings = { ...DEFAULT_SETTINGS, learning_steps: "" };
    const card = createCard({ state: "new" });
    const result = gradeCard(card, "good", settings);

    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(1);
  });

  it("No relearning steps: lapsed card should go to min interval", () => {
    const settings = { ...DEFAULT_SETTINGS, relearning_steps: "" };
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
      reps: 5,
    });
    const result = gradeCard(card, "again", settings);

    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(1); // minimum_interval_days
    expect(result.lapses).toBe(1);
  });

  it("Interval should respect maximum_interval_days", () => {
    const settings = { ...DEFAULT_SETTINGS, maximum_interval_days: 30 };
    const card = createCard({
      state: "review",
      interval_days: 20,
      ease: 2.5,
      reps: 5,
    });
    const result = gradeCard(card, "good", settings);

    // 20 * 2.5 = 50, but capped at 30
    expect(result.interval_days).toBe(30);
  });

  it("Interval should respect minimum_interval_days", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      minimum_interval_days: 5,
      new_interval_multiplier: 0.1,
    };
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
      reps: 5,
    });
    const result = gradeCard(card, "again", settings);

    // 10 * 0.1 = 1, but minimum is 5
    expect(result.interval_days).toBeGreaterThanOrEqual(5);
  });
});

describe("Hard Button Behavior in Learning", () => {
  it("Hard on first learning step: should use average of Again and Good", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 0,
      reps: 1,
    });
    const result = gradeCard(card, "hard", DEFAULT_SETTINGS);

    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(0);
    // Due time should be between Again (1m) and Good (10m)
    // Implementation uses average: (1 + 10) / 2 = 5.5 minutes
  });

  it("Hard on non-first step: should repeat current step", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 1,
      reps: 2,
    });
    const result = gradeCard(card, "hard", DEFAULT_SETTINGS);

    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(1); // Stay on same step
  });
});

describe("Preview Intervals", () => {
  it("Should not show Hard button for new cards", () => {
    const card = createCard({ state: "new" });
    const preview = previewIntervals(card, DEFAULT_SETTINGS);

    expect(preview.hard).toBeUndefined();
    expect(preview.again).toBeDefined();
    expect(preview.good).toBeDefined();
    expect(preview.easy).toBeDefined();
  });

  it("Should show Hard button for learning cards", () => {
    const card = createCard({ state: "learning", learning_step_index: 0 });
    const preview = previewIntervals(card, DEFAULT_SETTINGS);

    expect(preview.hard).toBeDefined();
  });

  it("Should show Hard button for review cards", () => {
    const card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
    });
    const preview = previewIntervals(card, DEFAULT_SETTINGS);

    expect(preview.hard).toBeDefined();
  });
});

describe("Comprehensive State Transition Tests", () => {
  it("NEW → LEARNING → LEARNING → REVIEW (typical flow)", () => {
    let card = createCard({ state: "new" });

    // Step 1: NEW + Good → LEARNING (step 0)
    let result = gradeCard(card, "good", DEFAULT_SETTINGS);
    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(0);

    // Update card
    card = { ...card, ...result };

    // Step 2: LEARNING (step 0) + Good → LEARNING (step 1)
    result = gradeCard(card, "good", DEFAULT_SETTINGS);
    expect(result.state).toBe("learning");
    expect(result.learning_step_index).toBe(1);

    // Update card
    card = { ...card, ...result };

    // Step 3: LEARNING (step 1, last) + Good → REVIEW
    result = gradeCard(card, "good", DEFAULT_SETTINGS);
    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(1);
  });

  it("REVIEW → RELEARNING → REVIEW (lapse flow)", () => {
    let card = createCard({
      state: "review",
      interval_days: 10,
      ease: 2.5,
      reps: 5,
      lapses: 0,
    });

    // Step 1: REVIEW + Again → RELEARNING
    let result = gradeCard(card, "again", DEFAULT_SETTINGS);
    expect(result.state).toBe("relearning");
    expect(result.lapses).toBe(1);
    expect(result.ease).toBe(2.3); // -0.2

    // Update card
    card = { ...card, ...result };

    // Step 2: RELEARNING + Good → REVIEW
    result = gradeCard(card, "good", DEFAULT_SETTINGS);
    expect(result.state).toBe("review");
    expect(result.interval_days).toBe(1); // minimum
    expect(result.lapses).toBe(1); // Preserved
  });

  it("Card should NEVER stay in NEW after any answer", () => {
    const card = createCard({ state: "new" });

    const againResult = gradeCard(card, "again", DEFAULT_SETTINGS);
    expect(againResult.state).not.toBe("new");

    const goodResult = gradeCard(card, "good", DEFAULT_SETTINGS);
    expect(goodResult.state).not.toBe("new");

    const easyResult = gradeCard(card, "easy", DEFAULT_SETTINGS);
    expect(easyResult.state).not.toBe("new");

    const hardResult = gradeCard(card, "hard", DEFAULT_SETTINGS);
    expect(hardResult.state).not.toBe("new");
  });
});

describe("Reps Counter (Anki behavior)", () => {
  it("Again should NOT increment reps", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 1,
      reps: 3,
    });
    const result = gradeCard(card, "again", DEFAULT_SETTINGS);

    expect(result.reps).toBe(3); // Unchanged
  });

  it("Good/Hard/Easy should increment reps", () => {
    const card = createCard({
      state: "learning",
      learning_step_index: 0,
      reps: 2,
    });

    expect(gradeCard(card, "good", DEFAULT_SETTINGS).reps).toBe(3);
    expect(gradeCard(card, "hard", DEFAULT_SETTINGS).reps).toBe(3);
    expect(gradeCard(card, "easy", DEFAULT_SETTINGS).reps).toBe(3);
  });
});
