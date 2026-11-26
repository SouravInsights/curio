import { useRef, useState } from "react";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import type { LibraryItem } from "@/lib/api";
import { Button } from "@curio/ui/components/button";
import { Input } from "@curio/ui/components/input";
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

/** The middle pane: the current view as a list of rows, plus the intake. */
export function ListPane({
  title,
  items,
  selectedId,
  onSelect,
  query,
  onQuery,
  onAddLink,
  onPrefetch,
}: {
  title: string;
  items: LibraryItem[];
  selectedId: number | null;
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
        <h1 className="type-heading">{title}</h1>
        <div className="flex items-center gap-0.5">
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
        </div>
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
            Nothing here yet. Paste a link with the + above, or import a reading list with
            <code className="ml-1 rounded-[var(--radius-sm)] bg-muted px-1 py-0.5 text-[12px]">
              curio import &lt;file&gt;
            </code>
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => onPrefetch(item.id)}
              onFocus={() => onPrefetch(item.id)}
              aria-current={item.id === selectedId}
              className={cn("list-row", item.id === selectedId && "bg-foreground/5")}
            >
              <span className="flex items-start gap-2.5">
                <Favicon item={item} />
                <span className="type-body line-clamp-2 text-foreground">
                  {item.title || item.url || "Untitled"}
                </span>
              </span>
              <span className="type-caption pl-[30px] text-faint-foreground">
                {[item.kind, item.wordCount ? `${item.wordCount.toLocaleString()} words` : null]
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
