"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/shell/Topbar";
import { DeckTree } from "@/components/DeckTree";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listDecks, createDeck, getDueCount, getDeckCardCounts, listCards } from "@/store/decks";
import { ImportDialog } from "@/components/ImportDialog";
import type { Deck } from "@/lib/db";
import { BookOpen } from "lucide-react";

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const [learningCounts, setLearningCounts] = useState<
    Record<string, { new: number; learning: number; review: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deckName, setDeckName] = useState("");

  const loadDecks = async () => {
    try {
      console.log('📂 loadDecks START');
      const loadedDecks = await listDecks();
      console.log('✅ Loaded', loadedDecks.length, 'decks:', loadedDecks);
      setDecks(loadedDecks);

      const counts: Record<string, number> = {};
      const due: Record<string, number> = {};
      const learning: Record<string, { new: number; learning: number; review: number }> = {};

      // Load all counts in parallel to avoid N+1
      // Load counts for all decks (including sub-decks)
      const countPromises = loadedDecks.map(async (deck) => {
        const [cards, dueCount, learningCount] = await Promise.all([
          listCards(deck.id),
          getDueCount(deck.id),
          getDeckCardCounts(deck.id),
        ]);
        const cardCount = cards.length;
        return {
          deckId: deck.id,
          cardCount,
          dueCount,
          learningCount,
        };
      });

      const countResults = await Promise.all(countPromises);
      for (const result of countResults) {
        counts[result.deckId] = result.cardCount;
        due[result.deckId] = result.dueCount;
        learning[result.deckId] = result.learningCount;
      }

      setCardCounts(counts);
      setDueCounts(due);
      setLearningCounts(learning);
      console.log('✅ loadDecks COMPLETE');
    } catch (error) {
      console.error("❌ Error loading decks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  const handleCreateDeck = async () => {
    if (!deckName.trim()) return;

    try {
      console.log('🔷 handleCreateDeck START with name:', deckName.trim());
      const newDeck = await createDeck(deckName.trim());
      console.log('✅ Deck created:', newDeck);

      console.log('📂 Reloading decks...');
      await loadDecks();
      console.log('✅ Decks reloaded');

      setDeckName("");
      setDialogOpen(false);
    } catch (error) {
      console.error("❌ Error creating deck:", error);
      alert("Error creating deck: " + (error as Error).message);
    }
  };

  const handleImportSuccess = async () => {
    await loadDecks();
  };

  // Get root decks (decks without parent)
  const rootDecks = decks.filter((d) => !d.parent_deck_id);

  return (
    <>
      <Topbar
        title="Decks"
        showNewDeck
        onNewDeck={() => setDialogOpen(true)}
        showImport
        onImport={() => setImportDialogOpen(true)}
      />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl w-full">
          {loading ? (
            <div className="rounded-xl border bg-white px-6 py-12 text-center">
              <p className="text-gray-500">Loading decks...</p>
            </div>
          ) : rootDecks.length === 0 ? (
            <div className="rounded-xl border bg-white px-6 py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No decks yet</h3>
              <p className="text-gray-500 mb-6">Create your first deck to start learning</p>
              <Button onClick={() => setDialogOpen(true)}>
                Create your first deck
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden">
              {rootDecks.map((deck) => (
                <DeckTree
                  key={deck.id}
                  deck={deck}
                  allDecks={decks}
                  cardCounts={cardCounts}
                  dueCounts={dueCounts}
                  learningCounts={learningCounts}
                  level={0}
                  onDeckCreated={loadDecks}
                  onDeckDeleted={loadDecks}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New deck</DialogTitle>
            <DialogDescription>
              Create a new deck to organize your cards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Deck name"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateDeck();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDeck}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        initialDeckId={null}
        onSuccess={handleImportSuccess}
      />
    </>
  );
}
