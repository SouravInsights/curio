"use client";

import { ArrowLeft, CaretRight, Hash, Tag } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/ui/button";
import { useTopics } from "@/lib/queries";
import { useLocal } from "@/lib/local/provider";
import { useLibraryItems } from "@/lib/local/items";
import { Skeleton, SkeletonGroup } from "./Loading";

/**
 * Browse the library by what it is made of.
 *
 * Two levels, both already on the document row: the classifier's fixed
 * **category** (article, tool, learning, …) and the freeform **topics** it
 * writes. The index carries counts, so you know how much is behind a door before
 * you open it, and opening one shows the matching documents in place rather than
 * throwing you back to the library with a filter you did not ask for.
 */
export function TopicsPane({
  category,
  topic,
  onBrowse,
  onOpen,
  onPrefetch,
}: {
  category?: string;
  topic?: string;
  onBrowse: (next: { category?: string; topic?: string }) => void;
  onOpen: (id: number) => void;
  onPrefetch: (id: number) => void;
}) {
  const selected = category ?? topic;

  if (selected) {
    return (
      <TopicDocuments
        category={category}
        topic={topic}
        onBack={() => onBrowse({})}
        onOpen={onOpen}
        onPrefetch={onPrefetch}
      />
    );
  }

  return <TopicIndex onBrowse={onBrowse} />;
}

function TopicIndex({
  onBrowse,
}: {
  onBrowse: (next: { category?: string; topic?: string }) => void;
}) {
  const topics = useTopics();
  const categories = topics.data?.categories ?? [];
  const keywords = topics.data?.topics ?? [];

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
        <h1 className="type-heading truncate pl-1">Topics</h1>
      </header>

      <div className="min-h-0 flex-1 scroll-contain overflow-y-auto px-3 pb-6">
        {topics.isLoading ? (
          <SkeletonGroup label="Reading your library" className="py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-row flex items-center gap-2.5 px-2 py-2"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Skeleton shimmer={false} className="h-4 w-4 flex-none" />
                <Skeleton shimmer={false} className="h-3.5 w-[45%]" />
                <Skeleton shimmer={false} className="ml-auto h-2.5 w-6" />
              </div>
            ))}
          </SkeletonGroup>
        ) : categories.length === 0 && keywords.length === 0 ? (
          <p className="type-caption py-6">
            Nothing to browse yet. Categories and topics are written when a document is read
            through the pipeline.
          </p>
        ) : null}

        {categories.length ? (
          <section className="pb-5 pt-2">
            <h2 className="type-label px-1 pb-2">Categories</h2>
            <div className="flex flex-col">
              {categories.map((row) => (
                <button
                  key={row.name}
                  onClick={() => onBrowse({ category: row.name })}
                  className="flex items-center gap-2.5 rounded-[var(--radius-row)] px-2 py-2 text-left transition-colors hover:bg-foreground/5"
                >
                  <Tag className="h-4 w-4 flex-none text-faint-foreground" />
                  <span className="type-body capitalize text-foreground">{row.name}</span>
                  <span className="type-caption ml-auto tabular-nums text-faint-foreground">
                    {row.count}
                  </span>
                  <CaretRight className="h-3.5 w-3.5 flex-none text-faint-foreground" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {keywords.length ? (
          <section className="pt-2">
            <h2 className="type-label px-1 pb-2">Topics</h2>
            <div className="flex flex-wrap gap-1.5">
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
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function TopicDocuments({
  category,
  topic,
  onBack,
  onOpen,
  onPrefetch,
}: {
  category?: string;
  topic?: string;
  onBack: () => void;
  onOpen: (id: number) => void;
  onPrefetch: (id: number) => void;
}) {
  const { db } = useLocal();
  const localItems = useLibraryItems(db, { category, topic });
  const items = localItems ?? [];
  const loading = localItems === undefined;
  const label = category ?? topic ?? "";

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="flex items-center gap-1 px-2 pb-2 pt-3">
        <Button variant="ghost" size="icon-sm" aria-label="All topics" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="type-heading truncate capitalize">{label}</h1>
        <span className="type-caption ml-auto pr-2 tabular-nums text-faint-foreground">
          {items.length}
        </span>
      </header>

      <div className="min-h-0 flex-1 scroll-contain overflow-y-auto px-1.5 pb-6">
        {loading ? (
          <SkeletonGroup label="Loading documents">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-row flex flex-col gap-2 px-3 py-3"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Skeleton shimmer={false} className="h-3.5 w-[70%]" />
                <Skeleton shimmer={false} className="h-2.5 w-2/5" />
              </div>
            ))}
          </SkeletonGroup>
        ) : items.length === 0 ? (
          <p className="type-caption px-3 py-6">Nothing filed under this yet.</p>
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
              <span className="type-caption text-faint-foreground">
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
