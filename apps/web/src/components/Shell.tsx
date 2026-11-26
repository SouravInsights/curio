"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@curio/ui/components/ui/resizable";
import { ShareQuoteDialog } from "@curio/ui/quote/dialog";
import { TooltipProvider } from "@curio/ui/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@curio/ui/components/ui/sheet";
import { useIsMobile } from "@curio/ui/hooks/use-mobile";
import { Books, MagnifyingGlass, Sparkle, Sun } from "@phosphor-icons/react";
import type { CreatePayload } from "@curio/ui/components/highlight/highlight";
import {
  addLink,
  archiveDocument,
  deleteAnnotation,
  getDocument,
  listDocuments,
  markRead,
  me,
  setReadState,
  setFavorite,
  recolorAnnotation,
  saveAnnotation,
  search,
  type DocumentDetail,
  type LibraryCounts,
  type LibraryItem,
  type Me,
} from "@/lib/api";
import { ListPane } from "./ListPane";
import { NavRail } from "./NavRail";
import { ReaderPane } from "./ReaderPane";
import { RightPane } from "./RightPane";

const EMPTY_COUNTS: LibraryCounts = { all: 0, unread: 0, reading: 0, read: 0, archived: 0, starred: 0 };
import { CommandPalette } from "./CommandPalette";
import { APPEARANCE_DEFAULT, type Appearance } from "./ReaderAppearance";
import { isDark, toggleTheme } from "@/lib/theme";
import { SignIn } from "./SignIn";
import { useQueryClient } from "@tanstack/react-query";
import { useUi } from "@/lib/store";
import {
  useAddLink,
  useArchive,
  useDeleteAnnotation,
  useDocument,
  useLibrary,
  useMe,
  usePrefetchDocument,
  useRecolorAnnotation,
  useSaveAnnotation,
  useSearchResults,
  useSetFavorite,
  useSetReadState,
  useUnarchive,
} from "@/lib/queries";

const VIEW_TITLES: Record<string, string> = {
  search: "Search",
  library: "Library",
  inbox: "Inbox",
  saved: "Saved",
  highlights: "Highlights",
  feeds: "Feeds",
  tags: "Tags",
};

/**
 * The shell. The icon rail is fixed; everything beside it is a resizable panel,
 * so the reading column keeps its measure while the list and the agent rail
 * take the width you give them.
 */
export function Shell() {
  const {
    view,
    setView,
    selectedId,
    setSelectedId,
    askOpen,
    setAskOpen,
    focus,
    setFocus,
    query,
    setQuery,
    filter: state,
    setFilter: setState,
    paletteOpen,
    setPaletteOpen,
    appearance,
    setAppearance,
  } = useUi();

  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);
  const [dark, setDark] = useState(true);
  const isMobile = useIsMobile();

  // Server state: one query per thing, and the cache is the cache.
  const client = useQueryClient();
  const account = useMe();
  const user = account.data;
  const signedIn = user != null;
  const library = useLibrary(filterParams(state, sort), signedIn);
  const opened = useDocument(selectedId);
  const doc = opened.data ?? null;
  const results = useSearchResults(query, signedIn);

  const prefetch = usePrefetchDocument();
  const favorite = useSetFavorite();
  const readState = useSetReadState();
  const archive = useArchive();
  const unarchive = useUnarchive();
  const addLink = useAddLink();
  const annotate = useSaveAnnotation(selectedId ?? 0);
  const recolor = useRecolorAnnotation(selectedId ?? 0);
  const erase = useDeleteAnnotation(selectedId ?? 0);

  /** "Starred" is a pseudo-state: it filters on the star, not on read_state. */
  function filterParams(current: string | undefined, order: "newest" | "oldest") {
    return current === "starred"
      ? { sort: order, favorite: true }
      : { sort: order, state: current };
  }

  const items: LibraryItem[] = query.trim()
    ? (results.data ?? []).map((hit) => ({
        id: hit.documentId,
        externalId: hit.externalId,
        title: hit.title,
        url: hit.url,
        site: "",
        author: "",
        kind: hit.kind,
        category: null,
        readState: "",
        favorite: false,
        summary: null,
        topics: null,
        addedAt: "",
        wordCount: null,
      }))
    : (library.data?.documents ?? []);
  const counts = library.data?.counts ?? EMPTY_COUNTS;
  const searching = results.isFetching;

  useEffect(() => {
    setDark(isDark());
  }, []);

  // ⌘K / Ctrl-K, and `/` when nothing is focused.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (mod && event.key.toLowerCase() === "b") {
        // Every shortcut the palette advertises is bound here, or it is a lie.
        event.preventDefault();
        setAskOpen((open) => !open);
      } else if (mod && event.key === ".") {
        event.preventDefault();
        setFocus((f) => !f);
      } else if (mod && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleTheme();
        setDark(isDark());
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (!mod && !typing && !paletteOpen && selectedId !== null) {
        // The palette advertises E / F / O on the open document. Bound here, or
        // the hints are decoration.
        if (event.key.toLowerCase() === "e") {
          event.preventDefault();
          void handleArchive();
        } else if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          handleToggleFavorite();
        } else if (event.key.toLowerCase() === "o") {
          const url = doc?.url;
          if (url) {
            event.preventDefault();
            window.open(url, "_blank", "noreferrer");
          }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, selectedId, doc]);

  async function handleAddLink(url: string) {
    const created = await addLink.mutateAsync(url);
    setSelectedId(created.id);
  }

  async function handleCreate(payload: CreatePayload): Promise<number | null> {
    if (selectedId == null) return null;
    const saved = await annotate.mutateAsync({ ...payload, kind: "highlight" });
    return saved.id;
  }

  function handleToggleFavorite() {
    if (!doc) return;
    favorite.mutate({ id: doc.id, favorite: !doc.favorite });
  }

  function handleMarkRead() {
    if (!doc) return;
    readState.mutate({ id: doc.id, state: doc.readState === "read" ? "unread" : "read" });
  }

  function handleArchive() {
    if (selectedId == null) return;
    // The row leaves the list on the next tick; move the selection off it first.
    setSelectedId(items.find((row) => row.id !== selectedId)?.id ?? null);
    archive.mutate(selectedId);
  }

  function handleUnarchive() {
    if (selectedId == null) return;
    unarchive.mutate(selectedId);
  }

  function handleRecolor(id: number, hue: number) {
    recolor.mutate({ id, hue });
  }

  function handleDelete(id: number) {
    erase.mutate(id);
  }

  const agentRail = (onClose: () => void) => (
    <RightPane
      doc={doc}
      onClose={onClose}
      onJumpToMark={(id) =>
        window.document
          .querySelector(`mark[data-annotation-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    />
  );

  if (user === undefined) return null;
  // Signing in changes the identity, so every cached answer is about nobody.
  if (!user) return <SignIn onDone={() => void client.invalidateQueries()} />;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
        <NavRail view={view} onView={setView} />

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {focus ? null : (
            <>
              <ResizablePanel defaultSize={24} minSize={16} maxSize={40} className="min-w-0">
                <ListPane
                  title={
                    query.trim()
                      ? `Search · ${searching ? "…" : items.length}`
                      : (VIEW_TITLES[view] ?? "Library")
                  }
                  items={items}
                  counts={counts}
                  selectedId={selectedId}
                  state={state}
                  onState={setState}
                  onSelect={setSelectedId}
                  query={query}
                  onQuery={setQuery}
                  onOpenPalette={() => setPaletteOpen(true)}
                  onPrefetch={prefetch}
                  mode={view === "search" ? "search" : "library"}
                  searching={searching}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={focus ? 100 : 46} minSize={30} className="min-w-0">
            <ReaderPane
              doc={doc}
              onCreate={handleCreate}
              onRecolor={handleRecolor}
              onDelete={handleDelete}
              onToggleAsk={() => setAskOpen((open) => !open)}
              onToggleFocus={() => setFocus((f) => !f)}
              onShareQuote={setShare}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onMarkRead={handleMarkRead}
              onToggleFavorite={handleToggleFavorite}
              appearance={appearance}
              onAppearance={setAppearance}
              askOpen={askOpen}
            />
          </ResizablePanel>

          {askOpen ? (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={46} className="min-w-0">
                {agentRail(() => setAskOpen(false))}
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        doc={doc}
        documents={items}
        dark={dark}
        onOpenDocument={(id) => setSelectedId(id)}
        onSearch={() => {
          setFocus(false);
          setView("search");
        }}
        onAddLink={() => {
          setFocus(false);
          window.document.querySelector<HTMLButtonElement>('button[aria-label="Add a link"]')?.click();
        }}
        onArchive={handleArchive}
        onToggleFavorite={handleToggleFavorite}
        onToggleAsk={() => setAskOpen((open) => !open)}
        onToggleFocus={() => setFocus((f) => !f)}
        onToggleTheme={() => {
          toggleTheme();
          setDark(isDark());
        }}
      />

      {/* The quote studio. Sharing a mark opens it with that quote. */}
      <ShareQuoteDialog
        open={share !== null}
        onOpenChange={(open) => {
          if (!open) setShare(null);
        }}
        quote={share?.quote ?? ""}
        context={share?.context ?? ""}
        title={doc?.title ?? ""}
        publication={doc?.site || doc?.url || ""}
      />
    </TooltipProvider>
  );
}

function MobileTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active}
      className={
        "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors " +
        (active ? "text-foreground" : "text-faint-foreground")
      }
    >
      {icon}
      {label}
    </button>
  );
}
