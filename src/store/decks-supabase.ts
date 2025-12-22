// Re-export all deck functions from the Supabase implementation
export {
  listDecks,
  createDeck,
  renameDeck,
  deleteDeck,
  getDeckAndAllChildren,
  getDeckPath,
  listDecksWithPaths,
  listCards,
  createCard,
  deleteCard,
  updateCard,
  suspendCard,
  unsuspendCard,
  moveCardsToDeck,
  getDueCards,
  getDueCount,
  getDeckCardCounts,
  reviewCard,
  getCardsStudiedToday,
  getCurrentStreak,
  getTotalReviews,
  type Deck,
  type Card,
  type Review,
  type ImportDoc,
  type GeneratedCard,
} from "@/lib/supabase-db";

// Note: Import-related functions are not yet migrated to Supabase
// These still use the old Dexie implementation for now
// You can migrate them later or keep them in Dexie since they're ephemeral

export { createImport, listImports, generateCards, persistGeneratedCards, type CardProposal, type GenerateCardsResult } from "./decks";
