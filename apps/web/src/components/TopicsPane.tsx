"use client";

import { ArrowLeft, Hash } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/ui/button";
import { useLocal } from "@/lib/local/provider";
import { useLibraryItems } from "@/lib/local/items";
import { useLocalTopics } from "@/lib/local/topics";
import { Skeleton, SkeletonGroup } from "./Loading";

/**
 * Browse the library by subject.
 *
 * A topic is a word that can sit on many documents — the describe step writes
 * them, and the policy keeps only the ones worth joining on. The index carries
 * counts, so you know how much is behind a door before you open it, and opening
 * one shows the matching documents in place rather than throwing you back to the
 * library with a filter you did not ask for.
 */
export function TopicsPane({
  topic,
  onBrowse,
  onOpen,
  onPrefetch,
}: {
  topic?: string;
  onBrowse: (next: { topic?: string }) => void;
  onOpen: (id: number) => void;
  onPrefetch: (id: number) => void;
}) {
  if (topic) {
    return (
      <TopicDocuments
        topic={topic}
        onBack={() => onBrowse({})}
        onOpen={onOpen}
        onPrefetch={onPrefetch}
      />
    );
  }
  return <TopicIndex onBrowse={onBrowse} />;
}

function TopicIndex({ onBrowse }: { onBrowse: (next: { topic?: string }) => void }) {
  // Local truth: every topic lives on a local `items` row.
  const { db } = useLocal();
  const topics = useLocalTopics(db);
  const keywords = topics ?? [];

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h1 className="type-heading truncate">Topics</h1>
      </header>

      <div className="min-h-0 flex-1 scroll-contain overflow-y-auto px-3 pb-6">
        {topics === undefined ? (
          <SkeletonGroup label="Reading your library">
            <div className="flex flex-wrap gap-1.5 pt-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton
                  key={i}
                  shimmer={false}
                  className="h-7 rounded-[var(--radius-pill)]"
                  style={{ width: `${56 + ((i * 17) % 72)}px`, animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
          </SkeletonGroup>
        ) : keywords.length === 0 ? (
          <p className="type-caption py-6">
            Nothing to browse yet. Topics are written when a document is read through the pipeline.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-3">
            {keywords.map((row) => (
              <button
                key={row.name}
                onClick={() => onBrowse({ topic: row.name })}
                className="flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-border px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <Hash className="h-3 w-3 text-faint-foreground" />
                {row.name}
                <span className="tabular-nums text-faint-foreground">{row.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function TopicDocuments({
  topic,
  onBack,
  onOpen,
  onPrefetch,
}: {
  topic: string;
  onBack: () => void;
  onOpen: (id: number) => void;
  onPrefetch: (id: number) => void;
}) {
  const { db } = useLocal();
  const localItems = useLibraryItems(db, { topic });
  const items = localItems ?? [];
  const loading = localItems === undefined;

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="header-bar flex shrink-0 items-center gap-1 border-b border-border px-2">
        <Button variant="ghost" size="icon-sm" aria-label="All topics" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="type-heading truncate capitalize">{topic}</h1>
        <span className="type-caption ml-auto pr-2 tabular-nums text-faint-foreground">
          {items.length}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1 scroll-contain overflow-y-auto p-1 pb-6">
        {loading ? (
          <SkeletonGroup label="Loading documents">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-row list-row pointer-events-none"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Skeleton shimmer={false} className="h-3.5 w-[70%]" />
                <Skeleton shimmer={false} className="h-2.5 w-2/5" />
              </div>
            ))}
          </SkeletonGroup>
        ) : items.length === 0 ? (
          <p className="type-caption px-2 py-6">Nothing filed under this yet.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item.id)}
              onMouseEnter={() => onPrefetch(item.id)}
              onFocus={() => onPrefetch(item.id)}
              className="list-row"
            >
              <span className="type-body line-clamp-2 text-foreground">
                {item.title || item.url || "Untitled"}
              </span>
              <span className="type-caption fade-truncate text-faint-foreground">
                {[item.kind, item.readState !== "unread" ? item.readState : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
