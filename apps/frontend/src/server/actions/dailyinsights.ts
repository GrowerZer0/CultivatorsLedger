"use server";

import { getUserId } from "@/lib/session";

// Simplified version that returns a placeholder response
export async function generateDailyBriefing(forceRefresh: boolean = false, plantId?: string) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized",
        snapshot: null,
        attention: [],
        actions: [],
      };
    }

    // Return a simple placeholder response
    return {
      success: true,
      snapshot: "Welcome to your Cultivator's Ledger dashboard. Start by logging your first check-in or importing data from your sensors.",
      attention: [],
      actions: ["Log your first check-in", "Import your data"],
      cached: false,
    };
  } catch (error) {
    console.error("Error generating briefing:", error);
    return {
      success: false,
      error: "Failed to generate briefing",
      snapshot: null,
      attention: [],
      actions: [],
    };
  }
}
