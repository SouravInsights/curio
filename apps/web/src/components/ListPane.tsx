import { useRef, useState } from "react";
import { CaretDown, FunnelSimple, MagnifyingGlass, Plus, Star, X } from "@phosphor-icons/react";
import type { LibraryCounts, LibraryItem } from "@/lib/api";
import { Button } from "@curio/ui/components/ui/button";
import { Input } from "@curio/ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@curio/ui/components/ui/popover";
import { cn } from "@curio/ui/lib/utils";

function hostOf(url: string | null): string | null {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
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
}) {
  // A hover preview: the summary, so you can tell two similar titles apart
  // without opening either. Delayed, because a card that appears on the way
  // past is noise.
  const [preview, setPreview] = useState<{ item: LibraryItem; top: number; left: number } | null>(
    null,
  );
  const hoverTimer = useRef<number | null>(null);

  function enterPreview(item: LibraryItem, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    hoverTimer.current = window.setTimeout(
      () => setPreview({ item, top: rect.top, left: rect.right + 10 }),
      350,
    );
  }

  function leavePreview() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setPreview(null);
  }

  const active = FILTERS.find((f) => f.id === state) ?? FILTERS[0]!;

  return (
    <aside className="flex h-full min-w-0 flex-col border-r border-border bg-sidebar">
      {mode === "search" ? (
        <div className="flex items-center gap-2 px-3 pb-3 pt-4">
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
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
        <h1 className="type-heading truncate pl-1">{title}</h1>

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

          <Button variant="ghost" size="icon-sm" aria-label="Add a link" onClick={onOpenPalette}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>
      )}

      <div className="min-h-0 flex-1 scroll-contain overflow-y-auto px-1.5 pb-6">
        {items.length === 0 ? (
          <p className="type-caption px-3 py-6">
            {mode === "search"
              ? searching
                ? "Searching…"
                : query.trim()
                  ? "Nothing matched. Search runs over the contents of everything you have saved, not just titles."
                  : "Type to search the contents of everything you have saved — meaning and exact words."
              : "Nothing here. Press + to add a link, or press ⌘K."}
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              onMouseEnter={(e) => {
                onPrefetch(item.id);
                enterPreview(item, e.currentTarget);
              }}
              onMouseLeave={leavePreview}
              onFocus={() => onPrefetch(item.id)}
              aria-current={item.id === selectedId}
              className={cn("list-row", item.id === selectedId && "bg-foreground/5")}
            >
              <span className="flex items-start gap-2.5">
                <Favicon item={item} />
                {item.favorite ? (
                  <Star
                    weight="fill"
                    aria-label="Starred"
                    className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--favorite)]"
                  />
                ) : null}
                <span className="type-body line-clamp-2 text-foreground">
                  {item.title || item.url || "Untitled"}
                </span>
              </span>
              <span className="type-caption flex items-center gap-1.5 pl-[30px] text-faint-foreground">
                {item.readState === "unread" ? (
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
                ) : null}
                {[
                  item.kind,
                  item.readState !== "unread" ? item.readState : null,
                  item.wordCount ? `${item.wordCount.toLocaleString()} words` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))
        )}
      </div>

      {preview ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 flex w-[320px] flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-popover p-3 shadow-[var(--shadow-popover)]"
          style={{ top: preview.top, left: preview.left }}
        >
          <p className="type-heading line-clamp-2">{preview.item.title || preview.item.url}</p>
          <p className="type-caption line-clamp-[9] text-muted-foreground">
            {preview.item.summary ||
              "No summary yet — it is written when the document is read through the pipeline."}
          </p>
          {preview.item.topics?.length ? (
            <p className="type-caption text-faint-foreground">
              {preview.item.topics.slice(0, 5).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
