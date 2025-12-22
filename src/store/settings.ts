import type { Settings } from "@/lib/db";
import {
  getSettings as getSettingsSupabase,
  updateSettings as updateSettingsSupabase,
} from "@/lib/supabase-db";

export type { Settings };

/**
 * Get settings (from Supabase, auto-created by trigger)
 */
export async function getSettings(): Promise<Settings> {
  return await getSettingsSupabase();
}

/**
 * Update settings (partial update)
 */
export async function updateSettings(
  partialSettings: Partial<Omit<Settings, "user_id" | "created_at" | "updated_at">>
): Promise<void> {
  await updateSettingsSupabase(partialSettings);
}

/**
 * Get learning steps based on learning mode
 */
export function getLearningSteps(mode: "fast" | "normal" | "deep"): number[] {
  switch (mode) {
    case "fast":
      return [10, 1440]; // 10 minutes, 1 day
    case "normal":
      return [10, 1440, 4320]; // 10 minutes, 1 day, 3 days
    case "deep":
      return [10, 1440, 4320, 10080]; // 10 minutes, 1 day, 3 days, 7 days
  }
}
