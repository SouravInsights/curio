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
 * ⌘K. The fastest way around a library that keeps growing: jump to a document
 * you remember the name of, or reach an action without hunting for its button.
 *
 * The site's palette is built on the same `command` primitive; this is that
 * structure with Curio's actions behind it.
 */
export function CommandPalette({
  open,
  onOpenChange,
  documents,
  dark,
  onOpenDocument,
  onSearch,
  onAddLink,
  onToggleAsk,
  onToggleFocus,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: LibraryItem[];
  dark: boolean;
  onOpenDocument: (id: number) => void;
  onSearch: () => void;
  onAddLink: () => void;
  onToggleAsk: () => void;
  onToggleFocus: () => void;
  onToggleTheme: () => void;
}) {
  // cmdk needs the list mounted before it will focus its own input reliably.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (open) setReady(true);
  }, [open]);

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search, or run a command…" />
      <CommandList>
        <CommandEmpty>Nothing matched.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(onSearch)}>
            <MagnifyingGlass className="mr-2 h-4 w-4" />
            Search the library
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(onAddLink)}>
            <Plus className="mr-2 h-4 w-4" />
            Add a link
          </CommandItem>
          <CommandItem onSelect={run(onToggleAsk)}>
            <Sparkle className="mr-2 h-4 w-4" />
            Toggle the agent rail
          </CommandItem>
          <CommandItem onSelect={run(onToggleFocus)}>
            <CornersOut className="mr-2 h-4 w-4" />
            Toggle focus mode
          </CommandItem>
          <CommandItem onSelect={run(onToggleTheme)}>
            {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {dark ? "Light theme" : "Dark theme"}
          </CommandItem>
        </CommandGroup>

        {ready && documents.length ? (
          <CommandGroup heading="Library">
            {documents.slice(0, 12).map((doc) => (
              <CommandItem
                key={doc.id}
                value={`${doc.title} ${doc.url ?? ""}`}
                onSelect={run(() => onOpenDocument(doc.id))}
              >
                <ArrowSquareOut className="mr-2 h-4 w-4" />
                <span className="truncate">{doc.title || doc.url || "Untitled"}</span>
                <span className="ml-auto pl-3 text-[11.5px] text-faint-foreground">{doc.kind}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
