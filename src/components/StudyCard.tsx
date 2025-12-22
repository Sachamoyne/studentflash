"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Tooltip } from "@/components/ui/tooltip";
import {
  reviewCard,
  getDueCount,
  updateCard,
  suspendCard,
  getDeckPath,
  listDecks,
  previewIntervals,
} from "@/store/decks";
import { getSettings } from "@/lib/supabase-db";
import type { Card as CardType, Deck, IntervalPreview } from "@/lib/db";
import {
  Edit,
  Pause,
  Maximize2,
  Minimize2,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/cn";

// Session requeue to mimic Anki learning behavior
// Cards marked "Again" reappear in the same session after a short delay
const REINSERT_AFTER = 3;

interface StudyCardProps {
  initialCards: CardType[];
  deckMap?: Map<string, Deck>;
  title: string;
  deckId: string;
  onComplete?: () => void;
}

export function StudyCard({
  initialCards,
  deckMap,
  title,
  deckId,
  onComplete,
}: StudyCardProps) {
  const router = useRouter();
  const [queue, setQueue] = useState<CardType[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [dueCount, setDueCount] = useState(0);
  const [againCardsCount, setAgainCardsCount] = useState(0);
  const [intervalPreviews, setIntervalPreviews] = useState<IntervalPreview | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [ratingFlash, setRatingFlash] = useState<string | null>(null);
  const [breadcrumbItems, setBreadcrumbItems] = useState<
    { label: string; href?: string }[]
  >([]);
  const queuedIds = useRef<Set<string>>(new Set(initialCards.map((c) => c.id)));
  const isSubmitting = useRef(false);

  // Load breadcrumb
  useEffect(() => {
    async function loadBreadcrumb() {
      const path = await getDeckPath(deckId);
      const parts = path.split(" > ");
      const items: { label: string; href?: string }[] = [];
      let currentPath = "";
      for (let i = 0; i < parts.length; i++) {
        currentPath += (i > 0 ? " > " : "") + parts[i];
        if (i < parts.length - 1) {
          // Find deck ID for this path part
          const allDecks = await listDecks();
          const deck = allDecks.find((d) => d.name === parts[i]);
          if (deck) {
            items.push({ label: parts[i], href: `/decks/${deck.id}` });
          }
        } else {
          items.push({ label: parts[i] });
        }
      }
      setBreadcrumbItems(items);
    }
    loadBreadcrumb();
  }, [deckId]);

  // Derive currentCard safely
  const currentCard = queue[currentIndex] ?? null;
  const currentDeck = currentCard && deckMap ? deckMap.get(currentCard.deckId) : null;

  const handleRate = useCallback(
    async (rating: "again" | "hard" | "good" | "easy") => {
      if (!currentCard) return;

      // Prevent double submit
      if (isSubmitting.current) {
        console.warn("⚠️ Already submitting, ignoring duplicate rate");
        return;
      }

      isSubmitting.current = true;
      const cardId = currentCard.id;
      const previousState = currentCard.state;

      console.log("🔵 handleRate START", { cardId, rating, previousState });

      try {
        // Persist review FIRST - wait for completion
        await reviewCard(cardId, rating);
        console.log("✅ reviewCard completed successfully");

        // THEN update UI
        const withoutCurrent = queue.filter((_, i) => i !== currentIndex);
        let newQueue: CardType[] = [];
        let newIndex = currentIndex;

        if (rating === "again") {
          const REINSERT_AFTER_VAL = Math.min(3, withoutCurrent.length);
          const insertAt = Math.min(
            withoutCurrent.length,
            currentIndex + REINSERT_AFTER_VAL
          );

          newQueue = [
            ...withoutCurrent.slice(0, insertAt),
            currentCard,
            ...withoutCurrent.slice(insertAt),
          ];

          queuedIds.current.add(currentCard.id);
          setAgainCardsCount((prev) => prev + 1);
          newIndex = Math.min(currentIndex, withoutCurrent.length - 1);
        } else {
          newQueue = withoutCurrent;
          queuedIds.current.delete(currentCard.id);
          if (againCardsCount > 0) {
            setAgainCardsCount((prev) => Math.max(0, prev - 1));
          }

          if (withoutCurrent.length === 0) {
            newIndex = 0;
          } else if (currentIndex >= withoutCurrent.length) {
            newIndex = withoutCurrent.length - 1;
          } else {
            newIndex = currentIndex;
          }
        }

        // Update state immediately
        setQueue(newQueue);
        setShowBack(false);

        // Visual feedback (non-blocking)
        setRatingFlash(rating);
        setTimeout(() => setRatingFlash(null), 200);

        // Advance to next card immediately
        if (newQueue.length === 0) {
          setCurrentIndex(0);
          onComplete?.();
        } else {
          setCurrentIndex(Math.min(newIndex, Math.max(0, newQueue.length - 1)));
        }

        // Update due count ASYNC (fire-and-forget)
        getDueCount(deckId)
          .then(setDueCount)
          .catch((err) => console.error("Error updating due count:", err));

        console.log("🔵 handleRate END - success");
      } catch (err) {
        console.error("❌ Error in handleRate:", err);
        setError(err instanceof Error ? err.message : "Failed to review card");
      } finally {
        isSubmitting.current = false;
      }
    },
    [queue, currentIndex, currentCard, againCardsCount, onComplete, deckId]
  );

  const handleEditCard = () => {
    if (!currentCard) return;
    setEditFront(currentCard.front);
    setEditBack(currentCard.back);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!currentCard || !editFront.trim() || !editBack.trim()) return;

    try {
      await updateCard(currentCard.id, editFront.trim(), editBack.trim());
      // Update card in queue
      const updatedQueue = queue.map((card) =>
        card.id === currentCard.id
          ? { ...card, front: editFront.trim(), back: editBack.trim() }
          : card
      );
      setQueue(updatedQueue);
      setEditDialogOpen(false);
    } catch (err) {
      console.error("Error updating card:", err);
      setError(err instanceof Error ? err.message : "Failed to update card");
    }
  };

  const handleSuspendCard = async () => {
    if (!currentCard) return;

    try {
      await suspendCard(currentCard.id);
      // Remove from queue
      const newQueue = queue.filter((_, i) => i !== currentIndex);
      setQueue(newQueue);
      setShowBack(false);

      if (newQueue.length === 0) {
        setCurrentIndex(0);
        onComplete?.();
      } else {
        setCurrentIndex(Math.min(currentIndex, Math.max(0, newQueue.length - 1)));
      }

      const newDueCount = await getDueCount(deckId);
      setDueCount(newDueCount);
    } catch (err) {
      console.error("Error suspending card:", err);
      setError(err instanceof Error ? err.message : "Failed to suspend card");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (!currentCard) return;

      // Space: show answer if front visible
      if (e.key === " " && !showBack) {
        e.preventDefault();
        setShowBack(true);
        return;
      }

      // Enter: Good rating if back visible, otherwise same as Space
      if (e.key === "Enter") {
        e.preventDefault();
        if (showBack) {
          handleRate("good");
        } else {
          setShowBack(true);
        }
        return;
      }

      // Rating keys (only work when back is visible)
      if (showBack) {
        if (e.key === "1") {
          e.preventDefault();
          handleRate("again");
        } else if (e.key === "2") {
          e.preventDefault();
          handleRate("hard");
        } else if (e.key === "3") {
          e.preventDefault();
          handleRate("good");
        } else if (e.key === "4") {
          e.preventDefault();
          handleRate("easy");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showBack, currentCard, handleRate]);

  // Update due count on mount
  useEffect(() => {
    getDueCount(deckId).then(setDueCount);
  }, [deckId]);

  // Calculate interval previews when card changes or back is shown
  useEffect(() => {
    if (!currentCard || !showBack) {
      setIntervalPreviews(null);
      return;
    }

    async function loadPreviews() {
      if (!currentCard) return;

      try {
        const settings = await getSettings();
        const schedulerSettings = {
          learning_steps: settings.learning_steps,
          relearning_steps: settings.relearning_steps,
          graduating_interval_days: settings.graduating_interval_days,
          easy_interval_days: settings.easy_interval_days,
          starting_ease: settings.starting_ease,
          easy_bonus: settings.easy_bonus,
          hard_interval: settings.hard_interval,
          interval_modifier: settings.interval_modifier,
          new_interval_multiplier: settings.new_interval_multiplier,
          minimum_interval_days: settings.minimum_interval_days,
          maximum_interval_days: settings.maximum_interval_days,
          again_delay_minutes: settings.again_delay_minutes,
        };

        const previews = previewIntervals(currentCard, schedulerSettings);
        setIntervalPreviews(previews);
      } catch (error) {
        console.error("Error loading interval previews:", error);
        setIntervalPreviews(null);
      }
    }

    loadPreviews();
  }, [currentCard, showBack]);

  if (queue.length === 0 || !currentCard) {
    const content = (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center space-y-6 py-12">
          <p className="text-xl font-semibold">All done!</p>
          <p className="text-muted-foreground">
            {dueCount === 0
              ? "No cards due for review."
              : `Session complete. (Due now: ${dueCount})`}
          </p>
          <Button onClick={() => router.push("/decks")}>Back to decks</Button>
        </div>
      </div>
    );

    if (focusMode) {
      return (
        <div className="fixed inset-0 z-50 bg-background">
          {content}
        </div>
      );
    }

    return (
      <>
        <Topbar title={title} />
        {content}
      </>
    );
  }

  const totalCards = initialCards.length;
  const completedCards = totalCards - queue.length;

  const studyContent = (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center space-y-6">
        {!focusMode && breadcrumbItems.length > 0 && (
          <Breadcrumb items={breadcrumbItems} className="self-start mb-4" />
        )}

        {error && (
          <div className="w-full rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!focusMode && (
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <div>
              {completedCards} / {totalCards} cards
            </div>
            <div>
              Session: {queue.length} card{queue.length !== 1 ? "s" : ""} remaining
            </div>
            {againCardsCount > 0 && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400">
                Again cards pending: {againCardsCount}
              </div>
            )}
            {currentDeck && (
              <div className="text-xs text-muted-foreground">
                Deck: {currentDeck.name}
              </div>
            )}
          </div>
        )}

        <div className="relative w-full">
          <div
            className="relative w-full min-h-[300px]"
            style={{
              transformStyle: "preserve-3d",
              transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)",
              transition: "transform 0.3s ease-in-out",
            }}
          >
            {/* Front face */}
            <Card
              className="absolute inset-0 w-full min-h-[300px]"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(0deg)",
              }}
            >
              <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-8">
                <div className="text-center">
                  <p className="mb-4 text-sm font-medium text-muted-foreground">
                    Front
                  </p>
                  <p className="text-2xl">{currentCard.front}</p>
                </div>
              </CardContent>
            </Card>

            {/* Back face */}
            <Card
              className="absolute inset-0 w-full min-h-[300px]"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-8">
                <div className="text-center">
                  <p className="mb-4 text-sm font-medium text-muted-foreground">
                    Back
                  </p>
                  <p className="text-2xl">{currentCard.back}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {!focusMode && (
            <div className="absolute top-4 right-4 flex gap-2">
              <Tooltip content="Edit card">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEditCard}
                  className="h-8 w-8"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Suspend card">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSuspendCard}
                  className="h-8 w-8"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Available in Pro version">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                  className="h-8 w-8"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Available in Pro version">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                  className="h-8 w-8"
                >
                  <Lightbulb className="h-4 w-4" />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 w-full">
          {!showBack ? (
              <Button
                onClick={() => setShowBack(true)}
                size="lg"
                disabled={!currentCard}
              >
                Show answer (Space / Enter)
              </Button>
          ) : (
            currentCard && (
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button
                  variant="destructive"
                  onClick={() => handleRate("again")}
                  size="lg"
                  className={cn(
                    "transition-all flex flex-col h-auto py-3",
                    ratingFlash === "again" && "scale-110 ring-2 ring-destructive"
                  )}
                >
                  <span className="font-semibold">Again (1)</span>
                  {intervalPreviews && (
                    <span className="text-xs opacity-80 mt-1">
                      {intervalPreviews.again}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRate("hard")}
                  size="lg"
                  className={cn(
                    "transition-all flex flex-col h-auto py-3",
                    ratingFlash === "hard" && "scale-110 ring-2 ring-ring"
                  )}
                >
                  <span className="font-semibold">Hard (2)</span>
                  {intervalPreviews?.hard && (
                    <span className="text-xs opacity-80 mt-1">
                      {intervalPreviews.hard}
                    </span>
                  )}
                </Button>
                <Button
                  onClick={() => handleRate("good")}
                  size="lg"
                  className={cn(
                    "transition-all flex flex-col h-auto py-3",
                    ratingFlash === "good" && "scale-110 ring-2 ring-primary"
                  )}
                >
                  <span className="font-semibold">Good (3)</span>
                  {intervalPreviews && (
                    <span className="text-xs opacity-80 mt-1">
                      {intervalPreviews.good}
                    </span>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleRate("easy")}
                  size="lg"
                  className={cn(
                    "transition-all flex flex-col h-auto py-3",
                    ratingFlash === "easy" && "scale-110 ring-2 ring-secondary"
                  )}
                >
                  <span className="font-semibold">Easy (4)</span>
                  {intervalPreviews && (
                    <span className="text-xs opacity-80 mt-1">
                      {intervalPreviews.easy}
                    </span>
                  )}
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  if (focusMode) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFocusMode(false)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          {studyContent}
        </div>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit card</DialogTitle>
              <DialogDescription>Update the front and back of this card.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Front</label>
                <Textarea
                  value={editFront}
                  onChange={(e) => setEditFront(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Back</label>
                <Textarea
                  value={editBack}
                  onChange={(e) => setEditBack(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Topbar
        title={`${title} - Due now: ${dueCount}`}
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFocusMode(true)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        }
      />
      {studyContent}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
            <DialogDescription>
              Update the front and back of this card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Front</label>
              <Textarea
                value={editFront}
                onChange={(e) => setEditFront(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Back</label>
              <Textarea
                value={editBack}
                onChange={(e) => setEditBack(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

