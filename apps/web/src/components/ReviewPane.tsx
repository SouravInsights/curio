"use client";

import { useState } from "react";
import { CheckCircle, Eye } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/button";
import { useGradeReview, useReviews } from "@/lib/queries";
import type { ReviewCard, ReviewGrade } from "@/lib/api";
import { Skeleton, SkeletonGroup } from "./Loading";

const GRADES: { grade: ReviewGrade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" },
];

/**
 * Recall. The reader's own marks come back at widening intervals so the reading
 * sticks. It is not a quiz the agent wrote — the prompt is the reader's own
 * highlight, and the act of remembering is theirs. The app only schedules.
 *
 * The card shows where the mark came from and hides its words until the reader
 * has tried to recall them; the reveal is the reward, not the default. Each
 * grade shows the interval it sets, so the choice is informed rather than a
 * guess at what "Good" means today.
 */
export function ReviewPane({
  onOpen,
}: {
  /** Open the document and jump to the mark. */
  onOpen: (documentId: number, clientId: string) => void;
}) {
  const reviews = useReviews();
  const gradeReview = useGradeReview();
  // Marks graded this session drop out of the queue even before the refetch
  // lands, so the next card appears instantly.
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState(false);

  const cards = reviews.data?.cards ?? [];
  const stats = reviews.data?.stats;
  const queue = cards.filter((card) => !reviewed.has(card.clientId));
  const card = queue[0];

  function grade(grade: ReviewGrade) {
    if (!card) return;
    setReviewed((prev) => new Set(prev).add(card.clientId));
    setRevealed(false);
    void gradeReview.mutate({ clientId: card.clientId, grade });
  }

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h1 className="type-heading truncate">Review</h1>
        {stats ? (
          <span className="type-meta tabular-nums text-faint-foreground">
            {queue.length} due
          </span>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 scroll-contain overflow-y-auto px-3 pb-6 pt-3">
        {reviews.isLoading ? (
          <SkeletonGroup label="Loading your review">
            <Skeleton className="h-44 rounded-[var(--radius-card)]" />
          </SkeletonGroup>
        ) : !card ? (
          <div className="flex flex-col items-center gap-2 px-4 py-20 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500" weight="fill" />
            <p className="type-heading">Nothing due</p>
            <p className="type-caption">
              {stats && stats.total > 0
                ? "Your marks come back at widening intervals. Read something new, and what you highlight joins them."
                : "Highlight a line while reading, and it comes back here to be remembered."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <article className="rounded-[var(--radius-card)] border border-border bg-card p-5">
              <p className="type-meta fade-truncate text-faint-foreground">{sourceOf(card)}</p>
              {revealed ? (
                <p className="type-body mt-3 border-l-2 border-border pl-3 text-foreground">
                  {card.quote}
                </p>
              ) : (
                <p className="type-body mt-3 text-muted-foreground">
                  What did this say, and why did you mark it?
                </p>
              )}
              {revealed && card.body ? (
                <p className="type-caption mt-3 pl-3">{card.body}</p>
              ) : null}
            </article>

            {revealed ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {GRADES.map(({ grade: value, label }) => (
                    <div key={value} className="flex flex-col items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => grade(value)}
                        className="w-full"
                      >
                        {label}
                      </Button>
                      <span className="type-meta tabular-nums text-faint-foreground">
                        {card.preview[value]}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onOpen(card.documentId, card.clientId)}
                  className="type-meta mx-auto text-faint-foreground transition-colors hover:text-foreground"
                >
                  See it in context
                </button>
              </div>
            ) : (
              <Button onClick={() => setRevealed(true)} className="mx-auto">
                <Eye className="h-4 w-4" />
                Reveal
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

/** The card's own line: what it is, and where it came from. */
function sourceOf(card: ReviewCard): string {
  return [card.title || "Untitled", card.site || card.author].filter(Boolean).join(" · ");
}
