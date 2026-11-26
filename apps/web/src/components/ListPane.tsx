import { useRef, useState } from "react";
import { MagnifyingGlass, Plus, Star } from "@phosphor-icons/react";
import type { LibraryCounts, LibraryItem } from "@/lib/api";
import { Button } from "@curio/ui/components/ui/button";
import { Input } from "@curio/ui/components/ui/input";
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
];

/** The middle pane: the reading list, its filter, and the intake. */
export function ListPane({
  title,
  items,
  counts,
  selectedId,
  state,
  sort,
  onState,
  onSort,
  onSelect,
  query,
  onQuery,
  onAddLink,
  onPrefetch,
}: {
  title: string;
  items: LibraryItem[];
  counts: LibraryCounts;
  selectedId: number | null;
  state: string | undefined;
  sort: "newest" | "oldest";
  onState: (state: string | undefined) => void;
  onSort: (sort: "newest" | "oldest") => void;
  onSelect: (id: number) => void;
  query: string;
  onQuery: (value: string) => void;
  onAddLink: (url: string) => Promise<void>;
  onPrefetch: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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

  async function submit() {
    const value = url.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      await onAddLink(value);
      setUrl("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full min-w-0 flex-col border-r border-border bg-sidebar">
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="type-heading flex items-baseline gap-2">
          {title}
          {counts.unread > 0 ? (
            <span className="type-caption text-faint-foreground">{counts.unread} unread</span>
          ) : null}
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Add a link"
          aria-expanded={adding}
          onClick={() => {
            setAdding((open) => !open);
            setError("");
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </header>

      {adding ? (
        <div className="px-3 pb-2">
          <Input
            ref={inputRef}
            value={url}
            placeholder="Paste a link and press Enter"
            aria-label="Link to add"
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            className="h-9"
          />
          <p className="type-caption mt-1.5 px-1">
            {busy ? "Reading the page…" : error || "It is fetched, read and summarised."}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <div className="flex items-center gap-0.5" role="group" aria-label="Filter by reading state">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              onClick={() => onState(filter.id)}
              aria-pressed={state === filter.id}
              className={cn(
                "rounded-[var(--radius-control)] px-2 py-1 text-[12.5px] font-medium transition-colors",
                state === filter.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-foreground/5",
              )}
            >
              {filter.label}
              {counts[filter.key] ? (
                <span className="ml-1 text-faint-foreground">{counts[filter.key]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <button
          onClick={() => onSort(sort === "newest" ? "oldest" : "newest")}
          className="type-caption shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-faint-foreground transition-colors hover:bg-foreground/5"
          aria-label={sort === "newest" ? "Newest first" : "Oldest first"}
        >
          {sort === "newest" ? "Newest" : "Oldest"}
        </button>
      </div>

      <div className="relative px-3 pb-2">
        <MagnifyingGlass className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-faint-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search this library"
          aria-label="Search this library"
          className="h-9 pl-9"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-6">
        {items.length === 0 ? (
          <p className="type-caption px-3 py-6">
            {query.trim()
              ? "Nothing matched. Search runs over the contents of everything you have saved."
              : "Nothing here. Paste a link with the + above, or import a reading list with curio import <file>."}
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
                    className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400"
                  />
                ) : null}
                <span className="type-body line-clamp-2 text-foreground">
                  {item.title || item.url || "Untitled"}
                </span>
              </span>
              <span className="type-caption flex items-center gap-1.5 pl-[30px] text-faint-foreground">
                {item.readState === "unread" ? (
                  <span aria-label="Unread" className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
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
