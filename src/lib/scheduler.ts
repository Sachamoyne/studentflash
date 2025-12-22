/**
 * Anki SM-2 Scheduler Implementation
 *
 * This implements the legacy Anki scheduling algorithm (SM-2 modified)
 * NOT FSRS.
 *
 * Key concepts:
 * - Learning: New cards go through learning steps (e.g., "1m 10m")
 * - Graduating: After final learning step, cards graduate to Review
 * - Review: Uses SM-2 with ease factor, intervals
 * - Relearning: Failed review cards go through relearning steps
 * - Lapses: Count of times a card has been forgotten
 */

import type { Card, Settings } from "./supabase-db";

export interface SchedulerSettings {
  learning_steps: string;
  relearning_steps: string;
  graduating_interval_days: number;
  easy_interval_days: number;
  starting_ease: number;
  easy_bonus: number;
  hard_interval: number;
  interval_modifier: number;
  new_interval_multiplier: number;
  minimum_interval_days: number;
  maximum_interval_days: number;
  again_delay_minutes: number;
}

export interface SchedulingResult {
  state: "new" | "learning" | "review" | "relearning";
  due_at: Date;
  interval_days: number;
  ease: number;
  learning_step_index: number;
  reps: number;
  lapses: number;
}

export interface IntervalPreview {
  again: string;
  hard?: string;
  good: string;
  easy: string;
}

// ============================================================================
// STEP PARSING
// ============================================================================

/**
 * Parse learning steps string into minutes
 * Examples:
 * - "1m 10m" -> [1, 10]
 * - "1m 10m 1d" -> [1, 10, 1440]
 * - "10m 1d 3d" -> [10, 1440, 4320]
 */
export function parseSteps(stepsStr: string): number[] {
  if (!stepsStr || stepsStr.trim() === "") {
    return [];
  }

  return stepsStr
    .trim()
    .split(/\s+/)
    .map((step) => {
      step = step.toLowerCase().trim();

      // Match patterns like: 1m, 10m, 1d, 1h
      const match = step.match(/^(\d+(?:\.\d+)?)(m|h|d)?$/);
      if (!match) {
        console.warn(`Invalid step format: "${step}", skipping`);
        return 0;
      }

      const value = parseFloat(match[1]);
      const unit = match[2] || "m"; // default to minutes

      switch (unit) {
        case "m":
          return value;
        case "h":
          return value * 60;
        case "d":
          return value * 24 * 60;
        default:
          return value;
      }
    })
    .filter((v) => v > 0);
}

/**
 * Check if a step duration crosses a day boundary (interday)
 * Steps >= 1 day are interday and should be scheduled to tomorrow
 */
export function isInterday(stepMinutes: number): boolean {
  return stepMinutes >= 1440; // >= 24 hours
}

/**
 * Convert minutes to a human-readable string
 */
export function formatInterval(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  }
  const days = Math.round(minutes / 1440);
  if (days === 1) return "1 jour";
  if (days < 30) return `${days} jours`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? "1 mois" : `${months} mois`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? "1 an" : `${years} ans`;
}

/**
 * Convert days to human-readable string
 */
export function formatIntervalDays(days: number): string {
  if (days < 1) return "<1 jour";
  if (days === 1) return "1 jour";
  if (days < 30) return `${Math.round(days)} jours`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? "1 mois" : `${months} mois`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? "1 an" : `${years} ans`;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Calculate due date from now + delay in minutes
 * For interday steps (>= 1 day), schedule to tomorrow at review time (e.g., 4am)
 */
function calculateDueDate(delayMinutes: number, now: Date = new Date()): Date {
  if (isInterday(delayMinutes)) {
    // Interday: schedule to next day at 4am (configurable)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + Math.floor(delayMinutes / 1440));
    tomorrow.setHours(4, 0, 0, 0);
    return tomorrow;
  } else {
    // Intraday: exact time
    return new Date(now.getTime() + delayMinutes * 60 * 1000);
  }
}

/**
 * Calculate due date from now + days
 */
function calculateDueDateDays(days: number, now: Date = new Date()): Date {
  const due = new Date(now);
  due.setDate(due.getDate() + Math.round(days));
  due.setHours(4, 0, 0, 0); // Schedule reviews for 4am
  return due;
}

/**
 * Clamp ease factor between min and max
 */
function clampEase(ease: number, min: number = 1.3, max: number = 3.0): number {
  return Math.max(min, Math.min(max, ease));
}

/**
 * Ensure new interval is at least old interval + 1 day (anti-stagnation)
 */
function ensureMinimumProgress(
  newInterval: number,
  oldInterval: number,
  minimumInterval: number
): number {
  // For review cards, ensure progress of at least 1 day
  if (oldInterval > 0 && newInterval <= oldInterval) {
    return oldInterval + 1;
  }
  return Math.max(newInterval, minimumInterval);
}

// ============================================================================
// SCHEDULING LOGIC
// ============================================================================

/**
 * Schedule a NEW card
 */
function scheduleNew(
  rating: "again" | "hard" | "good" | "easy",
  settings: SchedulerSettings,
  now: Date = new Date()
): SchedulingResult {
  const steps = parseSteps(settings.learning_steps);

  if (steps.length === 0) {
    // No learning steps: graduate immediately
    const intervalDays =
      rating === "easy"
        ? settings.easy_interval_days
        : settings.graduating_interval_days;

    return {
      state: "review",
      due_at: calculateDueDateDays(intervalDays, now),
      interval_days: intervalDays,
      ease: settings.starting_ease,
      learning_step_index: 0,
      reps: 1,
      lapses: 0,
    };
  }

  // Easy: skip learning, graduate immediately
  if (rating === "easy") {
    return {
      state: "review",
      due_at: calculateDueDateDays(settings.easy_interval_days, now),
      interval_days: settings.easy_interval_days,
      ease: settings.starting_ease,
      learning_step_index: 0,
      reps: 1,
      lapses: 0,
    };
  }

  // Again: go to first step
  if (rating === "again") {
    return {
      state: "learning",
      due_at: calculateDueDate(steps[0], now),
      interval_days: 0,
      ease: settings.starting_ease,
      learning_step_index: 0,
      reps: 0,
      lapses: 0,
    };
  }

  // Good: go to first step (new cards start at step 0)
  if (rating === "good") {
    return {
      state: "learning",
      due_at: calculateDueDate(steps[0], now),
      interval_days: 0,
      ease: settings.starting_ease,
      learning_step_index: 0,
      reps: 1,
      lapses: 0,
    };
  }

  // Hard: similar to Good for new cards (Anki behavior)
  return {
    state: "learning",
    due_at: calculateDueDate(steps[0], now),
    interval_days: 0,
    ease: settings.starting_ease,
    learning_step_index: 0,
    reps: 1,
    lapses: 0,
  };
}

/**
 * Schedule a LEARNING card
 */
function scheduleLearning(
  card: Card,
  rating: "again" | "hard" | "good" | "easy",
  settings: SchedulerSettings,
  now: Date = new Date()
): SchedulingResult {
  const steps = parseSteps(settings.learning_steps);
  const currentStepIndex = card.learning_step_index || 0;

  if (steps.length === 0) {
    // No steps: graduate
    return {
      state: "review",
      due_at: calculateDueDateDays(settings.graduating_interval_days, now),
      interval_days: settings.graduating_interval_days,
      ease: card.ease,
      learning_step_index: 0,
      reps: card.reps + 1,
      lapses: card.lapses,
    };
  }

  // Easy: graduate immediately
  if (rating === "easy") {
    return {
      state: "review",
      due_at: calculateDueDateDays(settings.easy_interval_days, now),
      interval_days: settings.easy_interval_days,
      ease: card.ease,
      learning_step_index: 0,
      reps: card.reps + 1,
      lapses: card.lapses,
    };
  }

  // Again: back to first step
  if (rating === "again") {
    return {
      state: "learning",
      due_at: calculateDueDate(steps[0], now),
      interval_days: 0,
      ease: card.ease,
      learning_step_index: 0,
      reps: card.reps,
      lapses: card.lapses,
    };
  }

  // Good: advance to next step or graduate
  if (rating === "good") {
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex >= steps.length) {
      // Graduate
      return {
        state: "review",
        due_at: calculateDueDateDays(settings.graduating_interval_days, now),
        interval_days: settings.graduating_interval_days,
        ease: card.ease,
        learning_step_index: 0,
        reps: card.reps + 1,
        lapses: card.lapses,
      };
    }

    // Move to next step
    return {
      state: "learning",
      due_at: calculateDueDate(steps[nextStepIndex], now),
      interval_days: 0,
      ease: card.ease,
      learning_step_index: nextStepIndex,
      reps: card.reps + 1,
      lapses: card.lapses,
    };
  }

  // Hard: special logic
  if (rating === "hard") {
    if (currentStepIndex === 0) {
      // First step: average of Again step and Good (next) step
      let delayMinutes: number;

      if (steps.length === 1) {
        // Only one step: 1.5x the step (capped at +1 day)
        delayMinutes = Math.min(steps[0] * 1.5, steps[0] + 1440);
      } else {
        // Average of current and next
        delayMinutes = (steps[0] + steps[1]) / 2;
      }

      return {
        state: "learning",
        due_at: calculateDueDate(delayMinutes, now),
        interval_days: 0,
        ease: card.ease,
        learning_step_index: 0,
        reps: card.reps + 1,
        lapses: card.lapses,
      };
    } else {
      // Other steps: repeat current step
      return {
        state: "learning",
        due_at: calculateDueDate(steps[currentStepIndex], now),
        interval_days: 0,
        ease: card.ease,
        learning_step_index: currentStepIndex,
        reps: card.reps + 1,
        lapses: card.lapses,
      };
    }
  }

  // Fallback
  return {
    state: "learning",
    due_at: calculateDueDate(steps[currentStepIndex], now),
    interval_days: 0,
    ease: card.ease,
    learning_step_index: currentStepIndex,
    reps: card.reps + 1,
    lapses: card.lapses,
  };
}

/**
 * Schedule a REVIEW card
 */
function scheduleReview(
  card: Card,
  rating: "again" | "hard" | "good" | "easy",
  settings: SchedulerSettings,
  now: Date = new Date()
): SchedulingResult {
  let ease = card.ease;
  let interval = card.interval_days;
  let lapses = card.lapses;
  let state: "review" | "relearning" = "review";

  // Again: lapse -> relearning
  if (rating === "again") {
    ease = clampEase(ease - 0.2);
    lapses += 1;

    // Apply new interval multiplier
    interval = Math.max(
      1,
      Math.round(interval * settings.new_interval_multiplier)
    );

    // Enter relearning
    const relearnSteps = parseSteps(settings.relearning_steps);
    if (relearnSteps.length > 0) {
      return {
        state: "relearning",
        due_at: calculateDueDate(relearnSteps[0], now),
        interval_days: interval,
        ease: ease,
        learning_step_index: 0,
        reps: card.reps + 1,
        lapses: lapses,
      };
    } else {
      // No relearning steps: min interval
      interval = settings.minimum_interval_days;
      return {
        state: "review",
        due_at: calculateDueDateDays(interval, now),
        interval_days: interval,
        ease: ease,
        learning_step_index: 0,
        reps: card.reps + 1,
        lapses: lapses,
      };
    }
  }

  // Hard
  if (rating === "hard") {
    ease = clampEase(ease - 0.15);
    interval = interval * settings.hard_interval;
  }

  // Good
  if (rating === "good") {
    interval = interval * ease;
  }

  // Easy
  if (rating === "easy") {
    ease = clampEase(ease + 0.15);
    interval = interval * ease * settings.easy_bonus;
  }

  // Apply interval modifier
  if (rating !== "again") {
    interval = interval * settings.interval_modifier;
  }

  // Apply bounds
  interval = Math.max(settings.minimum_interval_days, interval);
  interval = Math.min(settings.maximum_interval_days, interval);

  // Ensure minimum progress (anti-stagnation)
  interval = ensureMinimumProgress(
    interval,
    card.interval_days,
    settings.minimum_interval_days
  );

  // Round interval
  interval = Math.round(interval);

  return {
    state: "review",
    due_at: calculateDueDateDays(interval, now),
    interval_days: interval,
    ease: ease,
    learning_step_index: 0,
    reps: card.reps + 1,
    lapses: lapses,
  };
}

/**
 * Schedule a RELEARNING card
 */
function scheduleRelearning(
  card: Card,
  rating: "again" | "hard" | "good" | "easy",
  settings: SchedulerSettings,
  now: Date = new Date()
): SchedulingResult {
  const steps = parseSteps(settings.relearning_steps);
  const currentStepIndex = card.learning_step_index || 0;

  if (steps.length === 0) {
    // No relearning steps: back to review with min interval
    return {
      state: "review",
      due_at: calculateDueDateDays(settings.minimum_interval_days, now),
      interval_days: settings.minimum_interval_days,
      ease: card.ease,
      learning_step_index: 0,
      reps: card.reps + 1,
      lapses: card.lapses,
    };
  }

  // Easy: back to review immediately with min interval
  if (rating === "easy") {
    return {
      state: "review",
      due_at: calculateDueDateDays(settings.minimum_interval_days, now),
      interval_days: settings.minimum_interval_days,
      ease: card.ease,
      learning_step_index: 0,
      reps: card.reps + 1,
      lapses: card.lapses,
    };
  }

  // Again: back to first relearn step
  if (rating === "again") {
    return {
      state: "relearning",
      due_at: calculateDueDate(steps[0], now),
      interval_days: card.interval_days,
      ease: card.ease,
      learning_step_index: 0,
      reps: card.reps,
      lapses: card.lapses,
    };
  }

  // Good: advance or graduate
  if (rating === "good") {
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex >= steps.length) {
      // Graduate back to review
      return {
        state: "review",
        due_at: calculateDueDateDays(settings.minimum_interval_days, now),
        interval_days: settings.minimum_interval_days,
        ease: card.ease,
        learning_step_index: 0,
        reps: card.reps + 1,
        lapses: card.lapses,
      };
    }

    // Next step
    return {
      state: "relearning",
      due_at: calculateDueDate(steps[nextStepIndex], now),
      interval_days: card.interval_days,
      ease: card.ease,
      learning_step_index: nextStepIndex,
      reps: card.reps + 1,
      lapses: card.lapses,
    };
  }

  // Hard: repeat step (similar to learning)
  if (rating === "hard") {
    return {
      state: "relearning",
      due_at: calculateDueDate(steps[currentStepIndex], now),
      interval_days: card.interval_days,
      ease: card.ease,
      learning_step_index: currentStepIndex,
      reps: card.reps + 1,
      lapses: card.lapses,
    };
  }

  // Fallback
  return {
    state: "relearning",
    due_at: calculateDueDate(steps[currentStepIndex], now),
    interval_days: card.interval_days,
    ease: card.ease,
    learning_step_index: currentStepIndex,
    reps: card.reps + 1,
    lapses: card.lapses,
  };
}

// ============================================================================
// MAIN SCHEDULING FUNCTION
// ============================================================================

/**
 * Grade a card and calculate next review
 */
export function gradeCard(
  card: Card,
  rating: "again" | "hard" | "good" | "easy",
  settings: SchedulerSettings,
  now: Date = new Date()
): SchedulingResult {
  const state = card.state as "new" | "learning" | "review" | "relearning";

  switch (state) {
    case "new":
      return scheduleNew(rating, settings, now);
    case "learning":
      return scheduleLearning(card, rating, settings, now);
    case "review":
      return scheduleReview(card, rating, settings, now);
    case "relearning":
      return scheduleRelearning(card, rating, settings, now);
    default:
      throw new Error(`Unknown card state: ${state}`);
  }
}

/**
 * Preview intervals for all buttons (for UI display)
 */
export function previewIntervals(
  card: Card,
  settings: SchedulerSettings
): IntervalPreview {
  const now = new Date();

  const againResult = gradeCard(card, "again", settings, now);
  const goodResult = gradeCard(card, "good", settings, now);
  const easyResult = gradeCard(card, "easy", settings, now);

  let hardResult: SchedulingResult | null = null;
  const state = card.state as "new" | "learning" | "review" | "relearning";

  // Hard button only available for learning/review/relearning
  if (state !== "new") {
    hardResult = gradeCard(card, "hard", settings, now);
  }

  // Format intervals
  const formatResult = (result: SchedulingResult) => {
    if (result.state === "learning" || result.state === "relearning") {
      const minutes = Math.round(
        (result.due_at.getTime() - now.getTime()) / (60 * 1000)
      );
      return formatInterval(minutes);
    } else {
      return formatIntervalDays(result.interval_days);
    }
  };

  return {
    again: formatResult(againResult),
    hard: hardResult ? formatResult(hardResult) : undefined,
    good: formatResult(goodResult),
    easy: formatResult(easyResult),
  };
}
