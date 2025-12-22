"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listDecksWithPaths, moveCardsToDeck } from "@/store/decks";
import type { Deck } from "@/lib/db";

interface MoveCardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardIds: string[];
  currentDeckId: string;
  onSuccess: () => void;
}

export function MoveCardsDialog({
  open,
  onOpenChange,
  cardIds,
  currentDeckId,
  onSuccess,
}: MoveCardsDialogProps) {
  const [decksWithPaths, setDecksWithPaths] = useState<
    Array<{ deck: Deck; path: string }>
  >([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadDecks();
      setSelectedDeckId("");
      setError(null);
    }
  }, [open]);

  const loadDecks = async () => {
    try {
      const decks = await listDecksWithPaths();
      // Filter out current deck
      const filtered = decks.filter((d) => d.deck.id !== currentDeckId);
      setDecksWithPaths(filtered);
    } catch (err) {
      console.error("Error loading decks:", err);
      setError("Failed to load decks");
    }
  };

  const handleMove = async () => {
    if (!selectedDeckId) {
      setError("Please select a deck");
      return;
    }

    if (cardIds.length === 0) {
      setError("No cards selected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await moveCardsToDeck(cardIds, selectedDeckId);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Error moving cards:", err);
      setError(
        err instanceof Error ? err.message : "Failed to move cards"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move cards</DialogTitle>
          <DialogDescription>
            Move {cardIds.length} card{cardIds.length !== 1 ? "s" : ""} to...
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="targetDeck">Select Deck</Label>
            <select
              id="targetDeck"
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={loading}
            >
              <option value="">Select a deck...</option>
              {decksWithPaths.map(({ deck, path }) => (
                <option key={deck.id} value={deck.id}>
                  {path}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={loading || !selectedDeckId}>
            {loading ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

