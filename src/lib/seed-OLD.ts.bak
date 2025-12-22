import { db, type Deck, type Card } from "./db";

export async function seedDatabase(): Promise<void> {
  const deckCount = await db.decks.count();
  if (deckCount > 0) {
    return; // Already seeded
  }

  const now = Date.now();
  const deck1Id = crypto.randomUUID();
  const deck2Id = crypto.randomUUID();

  const decks: Deck[] = [
    {
      id: deck1Id,
      name: "Vocabulaire Français",
      createdAt: now,
      updatedAt: now,
      parentDeckId: null,
    },
    {
      id: deck2Id,
      name: "Histoire de France",
      createdAt: now + 1,
      updatedAt: now + 1,
      parentDeckId: null,
    },
  ];

  const cards: Card[] = [
    {
      id: crypto.randomUUID(),
      deckId: deck1Id,
      front: "Bonjour",
      back: "Hello",
      createdAt: now + 2,
      updatedAt: now + 2,
      dueAt: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      state: "new",
      suspended: false,
    },
    {
      id: crypto.randomUUID(),
      deckId: deck1Id,
      front: "Merci",
      back: "Thank you",
      createdAt: now + 3,
      updatedAt: now + 3,
      dueAt: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      state: "new",
      suspended: false,
    },
    {
      id: crypto.randomUUID(),
      deckId: deck1Id,
      front: "Au revoir",
      back: "Goodbye",
      createdAt: now + 4,
      updatedAt: now + 4,
      dueAt: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      state: "new",
      suspended: false,
    },
    {
      id: crypto.randomUUID(),
      deckId: deck2Id,
      front: "Quand a eu lieu la Révolution française ?",
      back: "1789",
      createdAt: now + 5,
      updatedAt: now + 5,
      dueAt: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      state: "new",
      suspended: false,
    },
    {
      id: crypto.randomUUID(),
      deckId: deck2Id,
      front: "Qui était le roi de France en 1789 ?",
      back: "Louis XVI",
      createdAt: now + 6,
      updatedAt: now + 6,
      dueAt: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      state: "new",
      suspended: false,
    },
  ];

  await db.decks.bulkAdd(decks);
  await db.cards.bulkAdd(cards);
}

