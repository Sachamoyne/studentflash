import Dexie, { type Table } from "dexie";

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  parentDeckId?: string | null;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  createdAt: number;
  updatedAt: number;
  // SRS fields (Phase 2)
  dueAt: number;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  state: "new" | "learning" | "review";
  lastReviewedAt?: number;
  // Phase 4
  suspended?: boolean;
}

export interface ImportDoc {
  id: string;
  deckId: string | null;
  filename: string;
  fileType: "pdf" | "image";
  createdAt: number;
  text: string;
  pageCount?: number;
  ocrConfidence?: number;
}

export interface GeneratedCard {
  id: string;
  importId: string;
  deckId: string;
  front: string;
  back: string;
  createdAt: number;
}

export interface Review {
  id: string;
  cardId: string;
  deckId: string;
  rating: "again" | "hard" | "good" | "easy";
  reviewedAt: number;
}

export interface Settings {
  id: "global";
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  learningMode: "fast" | "normal" | "deep";
  againDelayMinutes: number;
  reviewOrder: "mixed" | "oldFirst" | "newFirst";
}

class AnkiDatabase extends Dexie {
  decks!: Table<Deck>;
  cards!: Table<Card>;
  imports!: Table<ImportDoc>;
  generatedCards!: Table<GeneratedCard>;
  reviews!: Table<Review>;
  settings!: Table<Settings>;

  constructor() {
    super("AnkiDatabase");
    this.version(1).stores({
      decks: "id, name, createdAt, updatedAt",
      cards: "id, deckId, createdAt, updatedAt",
    });
    this.version(2).stores({
      decks: "id, name, createdAt, updatedAt",
      cards: "id, deckId, createdAt, updatedAt",
      imports: "id, deckId, createdAt",
      generatedCards: "id, importId, deckId, createdAt",
    });
    this.version(3)
      .stores({
        decks: "id, name, createdAt, updatedAt",
        cards: "id, deckId, createdAt, updatedAt, dueAt",
        imports: "id, deckId, createdAt",
        generatedCards: "id, importId, deckId, createdAt",
      })
      .upgrade(async (tx) => {
        const now = Date.now();
        const cards = await tx.table("cards").toCollection().toArray();
        for (const card of cards) {
          // Initialize SRS fields for existing cards
          if (!("dueAt" in card)) {
            await tx.table("cards").update(card.id, {
              dueAt: now,
              intervalDays: 0,
              ease: 2.5,
              reps: 0,
              lapses: 0,
              state: "new",
            });
          }
        }
      });
    this.version(4).stores({
      decks: "id, name, createdAt, updatedAt",
      cards: "id, deckId, createdAt, updatedAt, dueAt",
      imports: "id, deckId, createdAt",
      generatedCards: "id, importId, deckId, createdAt",
      reviews: "id, cardId, deckId, reviewedAt",
    });
    this.version(5)
      .stores({
        decks: "id, name, createdAt, updatedAt, parentDeckId",
        cards: "id, deckId, createdAt, updatedAt, dueAt",
        imports: "id, deckId, createdAt",
        generatedCards: "id, importId, deckId, createdAt",
        reviews: "id, cardId, deckId, reviewedAt",
      })
      .upgrade(async (tx) => {
        // Initialize parentDeckId = null for existing decks
        const decks = await tx.table("decks").toCollection().toArray();
        for (const deck of decks) {
          if (!("parentDeckId" in deck)) {
            await tx.table("decks").update(deck.id, {
              parentDeckId: null,
            });
          }
        }
      });
    this.version(6)
      .stores({
        decks: "id, name, createdAt, updatedAt, parentDeckId",
        cards: "id, deckId, createdAt, updatedAt, dueAt",
        imports: "id, deckId, createdAt",
        generatedCards: "id, importId, deckId, createdAt",
        reviews: "id, cardId, deckId, reviewedAt",
      })
      .upgrade(async (tx) => {
        // Initialize suspended = false for existing cards
        const cards = await tx.table("cards").toCollection().toArray();
        for (const card of cards) {
          if (!("suspended" in card)) {
            await tx.table("cards").update(card.id, {
              suspended: false,
            });
          }
        }
      });
    this.version(7)
      .stores({
        decks: "id, name, createdAt, updatedAt, parentDeckId",
        cards: "id, deckId, createdAt, updatedAt, dueAt",
        imports: "id, deckId, createdAt",
        generatedCards: "id, importId, deckId, createdAt",
        reviews: "id, cardId, deckId, reviewedAt",
        settings: "id",
      })
      .upgrade(async (tx) => {
        // Initialize default settings
        const defaultSettings: Settings = {
          id: "global",
          newCardsPerDay: 20,
          maxReviewsPerDay: 9999,
          learningMode: "normal",
          againDelayMinutes: 10,
          reviewOrder: "mixed",
        };
        await tx.table("settings").add(defaultSettings);
      });
  }
}

export const db = new AnkiDatabase();

