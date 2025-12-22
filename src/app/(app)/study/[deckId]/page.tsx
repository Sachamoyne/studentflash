"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudyCard } from "@/components/StudyCard";
import { getDueCards, getDeckPath, listDecks } from "@/store/decks";
import type { Deck } from "@/lib/db";

export default function DeckStudyPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.deckId as string;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [deckPath, setDeckPath] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDueCards() {
      try {
        const [allDecks, dueCards, path] = await Promise.all([
          listDecks(),
          getDueCards(deckId, 50),
          getDeckPath(deckId),
        ]);

        const loadedDeck = allDecks.find((d) => d.id === deckId);
        if (!loadedDeck) {
          router.push("/decks");
          return;
        }

        if (dueCards.length === 0) {
          router.push(`/decks/${deckId}`);
          return;
        }

        setDeck(loadedDeck);
        setCards(dueCards);
        setDeckPath(path);
      } catch (error) {
        console.error("Error loading due cards:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDueCards();
  }, [deckId, router]);

  if (loading || !deck) {
    return (
      <>
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <StudyCard
      initialCards={cards}
      title={`Study: ${deckPath}`}
      deckId={deckId}
      onComplete={() => router.push(`/decks/${deckId}`)}
    />
  );
}
