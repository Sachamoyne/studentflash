// Re-export settings functions from the Supabase implementation
import { getSettings as getSupabaseSettings, updateSettings as updateSupabaseSettings, type Settings as SupabaseSettings } from "@/lib/supabase-db";

export type Settings = {
  id: "global";
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  learningMode: "fast" | "normal" | "deep";
  againDelayMinutes: number;
  reviewOrder: "mixed" | "oldFirst" | "newFirst";
};

// Convert from Supabase format to UI format
function fromSupabaseSettings(supabaseSettings: SupabaseSettings): Settings {
  return {
    id: "global",
    newCardsPerDay: supabaseSettings.new_cards_per_day,
    maxReviewsPerDay: supabaseSettings.max_reviews_per_day,
    learningMode: supabaseSettings.learning_mode as "fast" | "normal" | "deep",
    againDelayMinutes: supabaseSettings.again_delay_minutes,
    reviewOrder: supabaseSettings.review_order as "mixed" | "oldFirst" | "newFirst",
  };
}

// Convert from UI format to Supabase format
function toSupabaseSettings(settings: Settings): Partial<SupabaseSettings> {
  return {
    new_cards_per_day: settings.newCardsPerDay,
    max_reviews_per_day: settings.maxReviewsPerDay,
    learning_mode: settings.learningMode,
    again_delay_minutes: settings.againDelayMinutes,
    review_order: settings.reviewOrder,
  };
}

export async function getSettings(): Promise<Settings> {
  const supabaseSettings = await getSupabaseSettings();
  return fromSupabaseSettings(supabaseSettings);
}

export async function updateSettings(settings: Settings): Promise<void> {
  await updateSupabaseSettings(toSupabaseSettings(settings));
}

export function getLearningSteps(mode: "fast" | "normal" | "deep"): number[] {
  switch (mode) {
    case "fast":
      return [1, 10];
    case "normal":
      return [1, 10, 60];
    case "deep":
      return [1, 10, 60, 180];
    default:
      return [1, 10, 60];
  }
}
