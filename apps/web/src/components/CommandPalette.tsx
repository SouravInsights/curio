"use client";

import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@curio/ui/components/ui/command";
import {
  Archive,
  ArrowSquareOut,
  CornersOut,
  MagnifyingGlass,
  Moon,
  Plus,
  Sparkle,
  Star,
  Sun,
} from "@phosphor-icons/react";
import { Curio } from "@curio/ui/components/curio/mascot";
import type { DocumentDetail, LibraryItem } from "@/lib/api";

/**
 * The command palette, built to the reference: **contextual and flat**.
 *
 * - The header says what the commands apply to — the document you are in, not
 *   the app's name.
 * - The field is the largest thing in the panel.
 * - Rows are tall and there are no group headings. A palette with headings is a
 *   menu; this is a command line.
 * - Keys are single letters on the right. Every one of them is bound in `Shell`,
 *   because a hint for a key that does nothing is a lie.
 */
export function CommandPalette({
  open,
  onOpenChange,
  doc,
  documents,
  dark,
  onOpenDocument,
  onAddLink,
  onSearch,
  onArchive,
  onToggleFavorite,
  onToggleAsk,
  onToggleFocus,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the commands apply to. Null when nothing is open. */
  doc: DocumentDetail | null;
  documents: LibraryItem[];
  dark: boolean;
  onOpenDocument: (id: number) => void;
  onAddLink: (url: string) => Promise<void> | void;
  onSearch: () => void;
  onArchive: () => void;
  onToggleFavorite: () => void;
  onToggleAsk: () => void;
  onToggleFocus: () => void;
  onToggleTheme: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setAdding(false);
    }
  }, [open]);

  const trimmed = query.trim();
  const looksLikeLink =
    /^https?:\/\//i.test(trimmed) || (/^[\w-]+(\.[\w-]+)+/.test(trimmed) && !trimmed.includes(" "));

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  async function addLink() {
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAddLink(trimmed);
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  }

  const host = (() => {
    try {
      return doc?.url ? new URL(doc.url).hostname : null;
    } catch {
      return null;
    }
  })();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Command palette">
      {/* What these commands apply to. */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-5">
        {host ? (
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain=${host}`}
            alt=""
            className="h-4 w-4 flex-none rounded-[var(--radius-sm)]"
          />
        ) : (
          <span className="flex-none text-green-600 dark:text-green-500">
            <Curio size={18} still />
          </span>
        )}
        <span className="type-body truncate text-foreground">
          {doc ? doc.title || doc.url : "Curio"}
        </span>
      </div>

      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Type a command or search…"
      />

      <CommandList>
        <CommandEmpty>Nothing matched.</CommandEmpty>

        {looksLikeLink ? (
          <CommandItem value={`add:${trimmed}`} onSelect={() => void addLink()} disabled={adding}>
            <Plus />
            <span className="truncate">{adding ? "Reading the page…" : `Add ${trimmed}`}</span>
            <CommandShortcut>↵</CommandShortcut>
          </CommandItem>
        ) : null}

        {/* The open document's own commands come first. */}
        {doc ? (
          <>
            <CommandItem onSelect={run(onArchive)}>
              <Archive />
              Archive
              <CommandShortcut>E</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={run(onToggleFavorite)}>
              <Star weight={doc.favorite ? "fill" : "regular"} />
              {doc.favorite ? "Unfavorite" : "Favorite"}
              <CommandShortcut>F</CommandShortcut>
            </CommandItem>
            {doc.url ? (
              <CommandItem
                onSelect={run(() => window.open(doc.url ?? "", "_blank", "noreferrer"))}
              >
                <ArrowSquareOut />
                Open original
                <CommandShortcut>O</CommandShortcut>
              </CommandItem>
            ) : null}
          </>
        ) : null}

        <CommandItem onSelect={run(onSearch)}>
          <MagnifyingGlass />
          Search the library
          <CommandShortcut>/</CommandShortcut>
        </CommandItem>
        <CommandItem onSelect={run(onToggleAsk)}>
          <Sparkle />
          Toggle the agent rail
          <CommandShortcut>⌘B</CommandShortcut>
        </CommandItem>
        <CommandItem onSelect={run(onToggleFocus)}>
          <CornersOut />
          Focus mode
          <CommandShortcut>⌘.</CommandShortcut>
        </CommandItem>
        <CommandItem onSelect={run(onToggleTheme)}>
          {dark ? <Sun /> : <Moon />}
          {dark ? "Light theme" : "Dark theme"}
          <CommandShortcut>⌘J</CommandShortcut>
        </CommandItem>

        {/* Recent reading, only when there is no document in context. */}
        {!doc
          ? documents.slice(0, 8).map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.title} ${item.url ?? ""}`}
                onSelect={run(() => onOpenDocument(item.id))}
              >
                <ArrowSquareOut />
                <span className="truncate">{item.title || item.url || "Untitled"}</span>
                <CommandShortcut>{item.kind}</CommandShortcut>
              </CommandItem>
            ))
          : null}
      </CommandList>
    </CommandDialog>
  );
}
