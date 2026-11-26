"use client";

import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@curio/ui/components/ui/command";
import {
  ArrowSquareOut,
  CornersOut,
  MagnifyingGlass,
  Moon,
  Plus,
  Sparkle,
  Sun,
} from "@phosphor-icons/react";
import type { LibraryItem } from "@/lib/api";

/**
 * ⌘K. One field for everything: search the library, run an action, or paste a
 * link. The link is not a separate mode — if what you typed looks like a URL, it
 * offers to add it, which is what the reference palette's "Paste or type a
 * link…" is doing.
 *
 * Every shortcut shown here is real; they are bound in `Shell`.
 */
export function CommandPalette({
  open,
  onOpenChange,
  documents,
  dark,
  onOpenDocument,
  onAddLink,
  onSearch,
  onToggleAsk,
  onToggleFocus,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: LibraryItem[];
  dark: boolean;
  onOpenDocument: (id: number) => void;
  onAddLink: (url: string) => Promise<void> | void;
  onSearch: () => void;
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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Command palette">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="type-label">Curio</span>
        <span className="type-caption text-faint-foreground">
          paste a link, or run a command
        </span>
      </div>

      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search, or paste a link…"
      />

      <CommandList>
        <CommandEmpty>Nothing matched.</CommandEmpty>

        {looksLikeLink ? (
          <CommandGroup heading="Add">
            <CommandItem value={`add:${trimmed}`} onSelect={() => void addLink()} disabled={adding}>
              <Plus className="h-4 w-4" />
              <span className="truncate">
                {adding ? "Reading the page…" : `Add ${trimmed}`}
              </span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(onSearch)}>
            <MagnifyingGlass className="h-4 w-4" />
            Search the library
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(onToggleAsk)}>
            <Sparkle className="h-4 w-4" />
            Toggle the agent rail
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(onToggleFocus)}>
            <CornersOut className="h-4 w-4" />
            Focus mode
            <CommandShortcut>⌘.</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(onToggleTheme)}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? "Light theme" : "Dark theme"}
            <CommandShortcut>⌘J</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {documents.length ? (
          <CommandGroup heading="Library">
            {documents.slice(0, 12).map((doc) => (
              <CommandItem
                key={doc.id}
                value={`${doc.title} ${doc.url ?? ""}`}
                onSelect={run(() => onOpenDocument(doc.id))}
              >
                <ArrowSquareOut className="h-4 w-4" />
                <span className="truncate">{doc.title || doc.url || "Untitled"}</span>
                <CommandShortcut>{doc.kind}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
