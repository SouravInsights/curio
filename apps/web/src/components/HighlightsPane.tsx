"use client";

import { useState } from "react";
import { Highlighter, MagnifyingGlass, NotePencil, X } from "@phosphor-icons/react";
import { Input } from "@curio/ui/components/ui/input";
import { HUES } from "@curio/ui/lib/highlight-palette";
import { useAnnotations } from "@/lib/queries";
import { Skeleton, SkeletonGroup } from "./Loading";

/**
 * Every mark you left, in one place.
 *
 * The Notebook tab shows the marks on *this* document; this is the library-wide
 * view — the notes you wrote to remember something, independent of which article
 * they came from. It is the answer to "what did I underline last month?", which
 * is a different question from "what is in my library?".
 *
 * A mark opens the document and scrolls to the span, so the list is a way back
 * into the text, not a dead index.
 */
export function HighlightsPane({
  onOpen,
}: {
  /** Open the document and jump to the mark. */
  onOpen: (documentId: number, annotationId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const marks = useAnnotations(query);
  const items = marks.data ?? [];

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
        <h1 className="type-heading truncate pl-1">Highlights</h1>
      </header>

      <div className="px-3 pb-3">
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your marks"
            aria-label="Search highlights and notes"
            className="h-9 pl-9 pr-9"
          />
          {query ? (
            <button
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[var(--radius-control)] text-faint-foreground hover:bg-[var(--hover)] hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 scroll-contain overflow-y-auto px-1.5 pb-6">
        {marks.isLoading ? (
          <SkeletonGroup label="Loading your highlights">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-row flex flex-col gap-2 px-3 py-3"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Skeleton shimmer={false} className="h-2.5 w-1/3" />
                <Skeleton shimmer={false} className="h-3.5 w-[85%]" />
                <Skeleton shimmer={false} className="h-3.5 w-[65%]" />
              </div>
            ))}
          </SkeletonGroup>
        ) : items.length === 0 ? (
          <p className="type-caption px-3 py-6">
            {query.trim()
              ? "No mark matched. Search runs over the words you highlighted and the notes you wrote."
              : "No highlights yet. Select a line while reading, then pick a colour — your marks collect here."}
          </p>
        ) : (
          items.map((mark) => (
            <button
              key={mark.id}
              onClick={() => onOpen(mark.documentId, mark.id)}
              className="list-row gap-2"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ backgroundColor: HUES[mark.hue]?.swatch }}
                />
                <span className="type-caption truncate text-faint-foreground">{mark.title}</span>
                {mark.kind === "note" ? (
                  <NotePencil className="ml-auto h-3.5 w-3.5 flex-none text-faint-foreground" />
                ) : (
                  <Highlighter className="ml-auto h-3.5 w-3.5 flex-none text-faint-foreground" />
                )}
              </span>
              {mark.quote ? (
                <span className="type-body line-clamp-3 border-l-2 border-border pl-3 text-foreground">
                  {mark.quote}
                </span>
              ) : null}
              {mark.body ? (
                <span className="type-caption line-clamp-3 pl-3 text-muted-foreground">
                  {mark.body}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
