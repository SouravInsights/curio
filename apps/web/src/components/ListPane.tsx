import {
  CaretDown,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  Star,
  X,
} from "@phosphor-icons/react";
import type { LibraryCounts, LibraryItem } from "@/lib/api";
import { Button } from "@curio/ui/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@curio/ui/components/ui/hover-card";
import { Input } from "@curio/ui/components/ui/input";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@curio/ui/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/ui/tooltip";
import { cn } from "@curio/ui/lib/utils";
import { keyFor } from "@/lib/shortcuts";
import { Skeleton, SkeletonGroup, ShimmerText } from "./Loading";

function hostOf(url: string | null): string | null {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/** What a document is, for the rows that have no source to name. */
const KIND_LABEL: Record<string, string> = {
  article: "Article",
  newsletter: "Newsletter",
  book: "Book",
  pdf: "PDF",
  note: "Note",
  video: "Video",
  thread: "Thread",
  other: "Reading",
};

/**
 * The byline. A source beats an author when both are known — a piece from a
 * publication belongs to the publication first — and the kind is the fallback
 * for a document with neither, which is exactly a book or a note.
 */
function provenanceOf(item: LibraryItem): string {
  return item.site || item.author || hostOf(item.url) || KIND_LABEL[item.kind] || "Reading";
}

/** A reading time a person can hold: minutes up to an hour and a half, then
 *  hours — one decimal only when the half matters. A book is not "1,200 min". */
function readingTimeOf(item: LibraryItem): string | null {
  if (!item.wordCount) return null;
  const minutes = Math.max(1, Math.round(item.wordCount / 230));
  if (minutes < 90) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

/**
 * The second line of a row. Two ends, not a list: the byline on the left, how
 * long it takes on the right. A `·`-joined string of three facts reads as a
 * dump; two ends read as a decision.
 */
function MetaLine({ item }: { item: LibraryItem }) {
  const time = readingTimeOf(item);
  return (
    <span className="flex w-full items-baseline justify-between gap-3">
      <span className="type-meta fade-truncate min-w-0 flex-1 text-faint-foreground">
        {provenanceOf(item)}
      </span>
      {time ? (
        <span className="type-meta flex-none tabular-nums text-faint-foreground">{time}</span>
      ) : null}
    </span>
  );
}

function Favicon({ item }: { item: LibraryItem }) {
  const host = hostOf(item.url);
  if (!host) {
    return (
      <span className="grid h-5 w-5 flex-none place-items-center rounded-[var(--radius-sm)] bg-muted text-[11px] font-semibold text-muted-foreground">
        {(item.kind[0] ?? "?").toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${host}`}
      alt=""
      loading="lazy"
      className="h-5 w-5 flex-none rounded-[var(--radius-sm)]"
    />
  );
}

const FILTERS: { id: string | undefined; label: string; key: keyof LibraryCounts }[] = [
  { id: undefined, label: "All", key: "all" },
  { id: "unread", label: "Unread", key: "unread" },
  { id: "reading", label: "Reading", key: "reading" },
  { id: "read", label: "Read", key: "read" },
  { id: "starred", label: "Starred", key: "starred" },
  { id: "archived", label: "Archived", key: "archived" },
];

/** The middle pane: the reading list, its filter, and the way in. */
export function ListPane({
  title,
  items,
  counts,
  selectedId,
  state,
  onState,
  onSelect,
  query,
  onQuery,
  onOpenPalette,
  onPrefetch,
  mode = "library",
  searching = false,
  loading = false,
  pendingUrl = null,
  skeletonCount = 3,
}: {
  title: string;
  items: LibraryItem[];
  counts: LibraryCounts;
  selectedId: number | null;
  state: string | undefined;
  onState: (state: string | undefined) => void;
  onSelect: (id: number) => void;
  query: string;
  onQuery: (value: string) => void;
  onOpenPalette: () => void;
  onPrefetch: (id: number) => void;
  /** `search` replaces the list with a search surface, rather than a field parked above it. */
  mode?: "library" | "search";
  searching?: boolean;
  /** First paint: no cached rows yet. */
  loading?: boolean;
  /** A link that is being read right now, shown above the list. */
  pendingUrl?: string | null;
  /** How many rows to draw while the first page loads. */
  skeletonCount?: number;
}) {
  const active = FILTERS.find((f) => f.id === state) ?? FILTERS[0]!;

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      {mode === "search" ? (
        <div className="header-bar flex shrink-0 items-center gap-2 border-b border-border px-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search your library"
              aria-label="Search your library"
              className="h-9 pl-9 pr-9"
            />
            {query ? (
              <button
                aria-label="Clear search"
                onClick={() => onQuery("")}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[var(--radius-control)] text-faint-foreground hover:bg-[var(--hover)] hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
      <header className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h1 className="type-heading min-w-0 truncate">{title}</h1>

        <div className="flex shrink-0 items-center gap-0.5">
          {/* The filter is a popover, not a row of chips: it is a setting, not
              something you switch while reading. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Filter by reading state"
                className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              >
                <FunnelSimple className="h-4 w-4" />
                <span className="text-[13px]">{active.label}</span>
                <CaretDown className="h-3 w-3 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={6} className="w-48 p-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.label}
                  onClick={() => onState(filter.id)}
                  data-active={state === filter.id}
                  className="flex w-full items-center justify-between rounded-[var(--radius-row)] px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--hover)] data-[active=true]:bg-foreground/[0.06] data-[active=true]:text-foreground"
                >
                  <span>{filter.label}</span>
                  {counts[filter.key] ? (
                    <span className="text-[12px] text-faint-foreground">{counts[filter.key]}</span>
                  ) : null}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Add a link" onClick={onOpenPalette}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              Add a link <Kbd>{keyFor("palette")}</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1 scroll-contain overflow-y-auto p-1 pb-6">
        {loading ? (
          <ListSkeleton rows={skeletonCount} />
        ) : (
          <>
            {pendingUrl ? <PendingRow url={pendingUrl} /> : null}
            {items.length === 0 ? (
              <p className="type-caption px-3 py-6">
                {mode === "search"
                  ? searching
                    ? "Searching…"
                    : query.trim()
                      ? "Nothing matched. Search runs over the contents of everything you have saved, not just titles."
                      : "Type to search everything you have saved, by meaning or by exact words."
                  : "Nothing here. Press + to add a link, or press ⌘K."}
              </p>
            ) : (
              items.map((item) => (
                // The preview is a HoverCard: Radix owns the delay and the
                // positioning, and the panel is portaled so the list's scroll
                // container cannot clip it.
                <HoverCard key={item.id} openDelay={350} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <button
                      onClick={() => onSelect(item.id)}
                      onMouseEnter={() => onPrefetch(item.id)}
                      onFocus={() => onPrefetch(item.id)}
                      aria-current={item.id === selectedId}
                      className={cn("list-row", item.id === selectedId && "bg-foreground/5")}
                    >
                      <span className="flex w-full items-center gap-2.5">
                        <Favicon item={item} />
                        {item.favorite ? (
                          <Star
                            weight="fill"
                            aria-label="Starred"
                            className="h-3.5 w-3.5 flex-none text-[var(--favorite)]"
                          />
                        ) : null}
                        <span className="type-body fade-truncate min-w-0 flex-1 text-foreground">
                          {item.title || item.url || "Untitled"}
                        </span>
                      </span>
                      <MetaLine item={item} />
                      {/* How far in, at a glance — momentum, and a reason to resume. */}
                      {item.readProgress > 0 && item.readProgress < 100 ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-2 bottom-0.5 h-[2px] overflow-hidden rounded-full bg-foreground/[0.08]"
                        >
                          <span
                            className="block h-full rounded-full bg-green-600/70 dark:bg-green-500/70"
                            style={{ width: `${item.readProgress}%` }}
                          />
                        </span>
                      ) : null}
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent side="right" className="flex flex-col gap-2">
                    <p className="type-heading line-clamp-2">{item.title || item.url}</p>
                    <p className="type-caption text-faint-foreground">
                      {[
                        item.kind,
                        item.readState !== "unread" ? item.readState : null,
                        item.wordCount ? `${item.wordCount.toLocaleString()} words` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="type-caption line-clamp-[9] text-muted-foreground">
                      {item.summary ||
                        "No summary yet. It is written when the document is read through the pipeline."}
                    </p>
                    {item.topics?.length ? (
                      <p className="type-caption text-faint-foreground">
                        {item.topics.slice(0, 5).join(" · ")}
                      </p>
                    ) : null}
                  </HoverCardContent>
                </HoverCard>
              ))
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/** The list's first paint: real row shapes, pulsing as one surface. */
function ListSkeleton({ rows }: { rows: number }) {
  return (
    <SkeletonGroup label="Loading your library">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-row list-row pointer-events-none"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span className="flex w-full items-center gap-2.5">
            <Skeleton shimmer={false} className="h-5 w-5 flex-none rounded-[var(--radius-sm)]" />
            <Skeleton
              shimmer={false}
              className="h-2.5"
              style={{ width: `${52 + ((i * 23) % 34)}%` }}
            />
          </span>
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** A link being read right now. The title itself sweeps; the row is the item. */
function PendingRow({ url }: { url: string }) {
  const host = hostOf(url);
  return (
    <div className="list-row" role="status" aria-live="polite">
      <span className="flex w-full items-center gap-2.5">
        <Skeleton shimmer={false} className="h-5 w-5 flex-none rounded-[var(--radius-sm)]" />
        <ShimmerText className="type-body min-w-0 flex-1 truncate text-foreground">
          {host ?? url}
        </ShimmerText>
      </span>
    </div>
  );
}
