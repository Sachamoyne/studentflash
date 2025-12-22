"use client";

import { useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createDeck, getDueCount, deleteDeck, getDeckCardCounts } from "@/store/decks";
import type { Deck } from "@/lib/db";
import { ChevronRight, ChevronDown, BookOpen, Plus, Trash2 } from "lucide-react";

interface DeckTreeProps {
  deck: Deck;
  allDecks: Deck[];
  cardCounts: Record<string, number>;
  dueCounts: Record<string, number>;
  learningCounts: Record<string, { new: number; learning: number; review: number }>;
  level: number;
  onDeckCreated: () => void;
  onDeckDeleted: () => void;
}

export function DeckTree({
  deck,
  allDecks,
  cardCounts,
  dueCounts,
  learningCounts,
  level,
  onDeckCreated,
  onDeckDeleted,
}: DeckTreeProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [subDeckDialogOpen, setSubDeckDialogOpen] = useState(false);
  const [subDeckName, setSubDeckName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const children = allDecks.filter((d) => d.parentDeckId === deck.id);
  const hasChildren = children.length > 0;
  const indent = level * 24; // 24px per level
  const parentDeck = deck.parentDeckId
    ? allDecks.find((d) => d.id === deck.parentDeckId)
    : null;

  const handleCreateSubDeck = async () => {
    if (!subDeckName.trim()) return;

    try {
      await createDeck(subDeckName.trim(), deck.id);
      setSubDeckName("");
      setSubDeckDialogOpen(false);
      onDeckCreated();
    } catch (error) {
      console.error("Error creating sub-deck:", error);
    }
  };

  const handleDeleteDeck = async () => {
    try {
      await deleteDeck(deck.id);
      setDeleteDialogOpen(false);
      onDeckDeleted();
    } catch (error) {
      console.error("Error deleting deck:", error);
    }
  };

  const handleDeckClick = () => {
    router.push(`/study/${deck.id}`);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleAddSubDeckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSubDeckDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleStudyParentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (parentDeck) {
      router.push(`/study/${parentDeck.id}`);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-4 px-4 py-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer group"
        style={{ paddingLeft: `${16 + indent}px` }}
        onClick={handleDeckClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleDeckClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Study deck: ${deck.name}`}
      >
        {/* Left area - Clickable */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {hasChildren ? (
            <button
              onClick={handleExpandClick}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}
          <BookOpen className="h-5 w-5 text-gray-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate mb-1.5">
              {deck.name}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const counts = learningCounts[deck.id];
                if (counts !== undefined) {
                  return (
                    <>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          counts.new > 0
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}
                      >
                        New {counts.new}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          counts.learning > 0
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}
                      >
                        Learning {counts.learning}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          counts.review > 0
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}
                      >
                        Review {counts.review}
                      </span>
                    </>
                  );
                }
                return (
                  <span className="text-xs text-gray-500">
                    {cardCounts[deck.id] || 0} cards
                  </span>
                );
              })()}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>

        {/* Right area - Actions (not clickable for navigation) */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {parentDeck && dueCounts[parentDeck.id] > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStudyParentClick}
              className="text-xs"
            >
              Study parent
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddSubDeckClick}
            aria-label="Add sub-deck"
            className="hover:bg-gray-200"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeleteClick}
            aria-label="Delete deck"
            className="hover:bg-gray-200 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <DeckTree
              key={child.id}
              deck={child}
              allDecks={allDecks}
              cardCounts={cardCounts}
              dueCounts={dueCounts}
              learningCounts={learningCounts}
              level={level + 1}
              onDeckCreated={onDeckCreated}
              onDeckDeleted={onDeckDeleted}
            />
          ))}
        </div>
      )}

      <Dialog open={subDeckDialogOpen} onOpenChange={setSubDeckDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New sub-deck</DialogTitle>
            <DialogDescription>
              Create a sub-deck under "{deck.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Sub-deck name"
              value={subDeckName}
              onChange={(e) => setSubDeckName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateSubDeck();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDeckDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubDeck}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete deck</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deck.name}"? This will also
              delete all sub-decks and cards. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteDeck}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

