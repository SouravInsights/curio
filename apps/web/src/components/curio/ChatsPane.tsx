"use client";

import { Plus } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/ui/button";
import { cn } from "@curio/ui/lib/utils";
import { useThreads } from "@/lib/queries";
import { Skeleton, SkeletonGroup } from "../Loading";

/**
 * The reader's conversations with Curio, newest activity first. The left pane of
 * the agent's destination: pick one up, or start a new one. The title is the
 * first question, so the list is scannable without opening anything.
 */
export function ChatsPane({
  selectedId,
  onSelect,
  onNew,
}: {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
}) {
  const threads = useThreads();
  const items = threads.data ?? [];

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h1 className="type-heading truncate">Chats</h1>
        <Button variant="ghost" size="icon-sm" aria-label="New conversation" onClick={onNew}>
          <Plus className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1 scroll-contain overflow-y-auto p-1 pb-6">
        {threads.isLoading ? (
          <SkeletonGroup label="Loading your chats">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-row list-row pointer-events-none"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Skeleton shimmer={false} className="h-3.5 w-[70%]" />
                <Skeleton shimmer={false} className="h-2.5 w-[45%]" />
              </div>
            ))}
          </SkeletonGroup>
        ) : items.length === 0 ? (
          <p className="type-caption px-2 py-6">No conversations yet. Ask Curio something.</p>
        ) : (
          items.map((thread) => (
            <button
              key={thread.id}
              onClick={() => onSelect(thread.id)}
              aria-current={thread.id === selectedId}
              className={cn("list-row", thread.id === selectedId && "bg-foreground/5")}
            >
              <span className="type-body fade-truncate min-w-0 text-foreground">
                {thread.title || "New conversation"}
              </span>
              <span className="type-meta fade-truncate text-faint-foreground">
                {thread.preview || "No messages yet"}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
