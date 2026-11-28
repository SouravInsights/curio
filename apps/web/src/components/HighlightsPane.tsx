"use client";

import { useState } from "react";
import {
  CaretDown,
  FunnelSimple,
  Highlighter,
  MagnifyingGlass,
  NotePencil,
  X,
} from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/ui/button";
import { Input } from "@curio/ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@curio/ui/components/ui/popover";
import { HUES } from "@curio/ui/lib/highlight-palette";
import { useLocalHighlights } from "@/lib/local/highlights";
import { useLocal } from "@/lib/local/provider";
import { Skeleton, SkeletonGroup } from "./Loading";

/** Which documents a mark search reaches: the library, the archive, or both. */
type MarkScope = "library" | "archived" | "all";

const SCOPES: { id: MarkScope; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

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
 *
 * Archived marks are kept, not hidden: they are still yours, and archiving a
 * piece should not make your own highlights unfindable. But they are out of the
 * default view, the same as the reading list — the filter is how you ask for
 * them.
 */
export function HighlightsPane({
  onOpen,
}: {
  /** Open the document and jump to the mark. */
  onOpen: (documentId: number, clientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<MarkScope>("library");
  // Local truth: the marks and the document rows are both on the device, so
  // this surface is a join over two stores, never a request.
  const { db } = useLocal();
  const marks = useLocalHighlights(db, { query, scope });
  const items = marks ?? [];
  const active = SCOPES.find((s) => s.id === scope) ?? SCOPES[0]!;

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h1 className="type-heading truncate">Highlights</h1>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Filter marks"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            >
              <FunnelSimple className="h-4 w-4" />
              <span className="text-[13px]">{active.label}</span>
              <CaretDown className="h-3 w-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-44 p-1">
            {SCOPES.map((option) => (
              <button
                key={option.id}
                onClick={() => setScope(option.id)}
                data-active={scope === option.id}
                className="flex w-full items-center rounded-[var(--radius-row)] px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--hover)] data-[active=true]:bg-foreground/[0.06] data-[active=true]:text-foreground"
              >
                {option.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </header>

      <div className="shrink-0 px-3 py-3">
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

      <div className="flex min-h-0 flex-1 flex-col gap-1 scroll-contain overflow-y-auto p-1 pb-6">
        {marks === undefined ? (
          <SkeletonGroup label="Loading your highlights">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-row list-row pointer-events-none"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Skeleton shimmer={false} className="h-2.5 w-1/3" />
                <Skeleton shimmer={false} className="h-3.5 w-[85%]" />
                <Skeleton shimmer={false} className="h-3.5 w-[65%]" />
              </div>
            ))}
          </SkeletonGroup>
        ) : items.length === 0 ? (
          <p className="type-caption px-2 py-6">
            {query.trim()
              ? "No mark matched. Search runs over the words you highlighted and the notes you wrote."
              : scope === "archived"
                ? "No marks from archived documents. Archive a piece and its marks move here."
                : "No highlights yet. Select a line while reading, then pick a colour — your marks collect here."}
          </p>
        ) : (
          items.map((mark) => (
            <button
              key={mark.clientId}
              onClick={() => onOpen(mark.documentId, mark.clientId)}
              className="list-row"
            >
              <span className="flex w-full items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ backgroundColor: HUES[mark.hue]?.swatch }}
                />
                <span className="type-caption fade-truncate min-w-0 flex-1 text-faint-foreground">
                  {mark.title}
                </span>
                {mark.note ? (
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
