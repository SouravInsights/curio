"use client";

import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@curio/ui/components/ui/resizable";
import { ShareQuoteDialog } from "@curio/ui/quote/dialog";
import { TooltipProvider } from "@curio/ui/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@curio/ui/components/ui/sheet";
import { useIsMobile } from "@curio/ui/hooks/use-mobile";
import {
  Books,
  GearSix,
  Highlighter,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react";
import type { CreatePayload } from "@curio/ui/components/highlight/highlight";
import {
  type LibraryCounts,
  type LibraryItem,
} from "@/lib/api";
import { ListPane } from "./ListPane";
import { NavRail } from "./NavRail";
import { ReaderPane } from "./ReaderPane";
import { RightPane } from "./RightPane";
import { HighlightsPane } from "./HighlightsPane";
import { TopicsPane } from "./TopicsPane";
import { SettingsPane } from "./SettingsPane";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { isDark, toggleTheme } from "@/lib/theme";
import { SHORTCUTS } from "@/lib/shortcuts";
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

const EMPTY_COUNTS: LibraryCounts = { all: 0, unread: 0, reading: 0, read: 0, archived: 0, starred: 0 };

const VIEW_TITLES: Record<string, string> = {
  search: "Search",
  library: "Library",
};

/**
 * The shell. The icon rail is fixed; everything beside it is a resizable panel,
 * so the reading column keeps its measure while the list and the agent rail
 * take the width you give them.
 *
 * The left pane is the *destination*: the library list, search, your highlights,
 * or the topic index. The reader is always the middle column, so opening
 * something from any destination keeps the same reading surface. Settings is the
 * one exception — it has no list and no reader.
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
    browse,
    setBrowse,
    paletteOpen,
    setPaletteOpen,
    appearance,
    setAppearance,
  } = useUi();

  const [sort] = useState<"newest" | "oldest">("newest");
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);
  const [dark, setDark] = useState(true);
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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

  /**
   * Jumping to a mark. The highlight engine rebuilds the mark DOM after the
   * article mounts, so the target is not there on the first frame; this retries
   * until it is, or gives up. `[data-hl]` is the attribute the engine paints —
   * the old selector named an attribute nothing ever set, so the jump silently
   * did nothing.
   */
  useEffect(() => {
    if (jumpTo == null || !doc) return;
    let cancelled = false;
    const target = jumpTo;
    const started = performance.now();
    function attempt() {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-hl="${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setJumpTo(null);
        return;
      }
      if (performance.now() - started < 2000) requestAnimationFrame(attempt);
      else setJumpTo(null);
    }
    const raf = requestAnimationFrame(attempt);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [doc, jumpTo]);

  // Every shortcut is dispatched from `lib/shortcuts`, the same list the
  // tooltips, the palette and the help sheet render. A key cannot be advertised
  // in one surface and bound differently in another.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (typing) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const match = SHORTCUTS.find(
        (shortcut) => Boolean(shortcut.mod) === mod && shortcut.key === key,
      );
      // `/` is the reader's search key; it opens the palette, same as ⌘K.
      const slash = !mod && key === "/";
      if (!match && !slash) return;
      if (match?.needsDocument && selectedId === null) return;

      event.preventDefault();
      switch (match?.id ?? "palette") {
        case "palette":
          setPaletteOpen((open) => !open);
          break;
        case "ask":
        case "rail":
          setAskOpen((open) => !open);
          break;
        case "focus":
          setFocus((f) => !f);
          break;
        case "theme":
          toggleTheme();
          setDark(isDark());
          break;
        case "help":
          setShortcutsOpen(true);
          break;
        case "archive":
          handleArchive();
          break;
        case "star":
          handleToggleFavorite();
          break;
        case "read":
          handleMarkRead();
          break;
        case "open": {
          const url = doc?.url;
          if (url) window.open(url, "_blank", "noreferrer");
          break;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, doc, items]);

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

  /** Open a document and scroll to one of its marks. */
  function openMark(documentId: number, annotationId: number) {
    setSelectedId(documentId);
    setJumpTo(annotationId);
  }

  function chooseView(next: string) {
    setView(next);
    // Leaving a destination clears the browse selection so Topics opens on the
    // index, not on whatever was open last time.
    if (next !== "topics") setBrowse({});
  }

  const agentRail = (onClose: () => void) => (
    <RightPane
      doc={doc}
      onClose={onClose}
      onJumpToMark={(id) => setJumpTo(id)}
      onOpenDocument={(id) => setSelectedId(id)}
    />
  );

  /** The left column, by destination. */
  const destination =
    view === "highlights" ? (
      <HighlightsPane onOpen={openMark} />
    ) : view === "topics" ? (
      <TopicsPane
        category={browse.category}
        topic={browse.topic}
        onBrowse={setBrowse}
        onOpen={(id) => setSelectedId(id)}
        onPrefetch={prefetch}
      />
    ) : (
      <ListPane
        title={query.trim() ? `Search · ${searching ? "…" : items.length}` : (VIEW_TITLES[view] ?? "Library")}
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
    );

  /**
   * The palette, in one place. It used to be inside the desktop return, so on a
   * phone the "+" button set the state and nothing was mounted to render it.
   */
  const palette = (
    <CommandPalette
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      doc={doc}
      documents={items}
      dark={dark}
      onOpenDocument={(id) => setSelectedId(id)}
      onSearch={() => {
        setFocus(false);
        chooseView("search");
      }}
      onAddLink={(url) => void handleAddLink(url)}
      onArchive={doc?.readState === "archived" ? handleUnarchive : handleArchive}
      onToggleFavorite={handleToggleFavorite}
      onMarkRead={handleMarkRead}
      onToggleAsk={() => setAskOpen((open) => !open)}
      onToggleFocus={() => setFocus((f) => !f)}
      onToggleTheme={() => {
        toggleTheme();
        setDark(isDark());
      }}
      onOpenShortcuts={() => setShortcutsOpen(true)}
    />
  );

  if (user === undefined) return null;
  // Signing in changes the identity, so every cached answer is about nobody.
  if (!user) return <SignIn onDone={() => void client.invalidateQueries()} />;

  const settings = <SettingsPane user={user} appearance={appearance} onAppearance={setAppearance} />;

  /**
   * Mobile is a different layout, not a narrower one: one column, the list or
   * the reader, a bottom bar a thumb can reach, and the agent as a sheet. Three
   * panes in 390px is not a layout.
   */
  if (isMobile) {
    const reading = doc !== null && view !== "settings";
    return (
      <TooltipProvider delayDuration={250}>
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
          <div className="min-h-0 flex-1">
            {view === "settings" ? (
              settings
            ) : reading ? (
              <ReaderPane
                doc={doc}
                onCreate={handleCreate}
                onRecolor={handleRecolor}
                onDelete={handleDelete}
                onToggleAsk={() => setAskOpen(true)}
                onToggleFocus={() => setFocus((f) => !f)}
                onShareQuote={setShare}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                onMarkRead={handleMarkRead}
                onToggleFavorite={handleToggleFavorite}
                appearance={appearance}
                onAppearance={setAppearance}
                onBack={() => setSelectedId(null)}
                focus={focus}
                askOpen={askOpen}
              />
            ) : (
              destination
            )}
          </div>

          <nav className="flex shrink-0 items-stretch border-t border-border bg-sidebar pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
            <MobileTab
              icon={<Books className="h-5 w-5" />}
              label="Library"
              active={!reading && view === "library"}
              onClick={() => {
                setSelectedId(null);
                chooseView("library");
              }}
            />
            <MobileTab
              icon={<MagnifyingGlass className="h-5 w-5" />}
              label="Search"
              active={!reading && view === "search"}
              onClick={() => {
                setSelectedId(null);
                chooseView("search");
              }}
            />
            <MobileTab
              icon={<Highlighter className="h-5 w-5" />}
              label="Marks"
              active={!reading && view === "highlights"}
              onClick={() => {
                setSelectedId(null);
                chooseView("highlights");
              }}
            />
            <MobileTab
              icon={<Sparkle className="h-5 w-5" />}
              label="Ask"
              active={askOpen}
              onClick={() => setAskOpen(true)}
            />
            <MobileTab
              icon={<GearSix className="h-5 w-5" />}
              label="Settings"
              active={!reading && view === "settings"}
              onClick={() => {
                setSelectedId(null);
                chooseView("settings");
              }}
            />
          </nav>

          <Sheet open={askOpen} onOpenChange={setAskOpen}>
            <SheetContent side="bottom" className="h-[88dvh] gap-0 p-0" showClose={false}>
              <SheetTitle className="sr-only">Ask Curio</SheetTitle>
              {agentRail(() => setAskOpen(false))}
            </SheetContent>
          </Sheet>
        </div>

        {palette}
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

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

  const isSettings = view === "settings";

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
        <NavRail view={view} onView={chooseView} />

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Stable ids and explicit order. Panels are added and removed as the
              reader focuses, opens Settings, or toggles the agent rail; without
              an order the group re-associates its saved layout by registration
              index, and a handle can end up driving the wrong panel. */}
          {focus || isSettings ? null : (
            <>
              <ResizablePanel
                id="library"
                order={1}
                defaultSize={24}
                minSize={16}
                maxSize={40}
                className="min-w-0"
              >
                {destination}
              </ResizablePanel>
              <ResizableHandle id="library-reader" withHandle />
            </>
          )}

          <ResizablePanel
            id="reader"
            order={2}
            defaultSize={focus || isSettings ? 100 : 46}
            minSize={30}
            className="min-w-0"
          >
            {isSettings ? (
              settings
            ) : (
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
                focus={focus}
                askOpen={askOpen}
              />
            )}
          </ResizablePanel>

          {askOpen && !isSettings ? (
            <>
              <ResizableHandle id="reader-agent" withHandle />
              <ResizablePanel
                id="agent"
                order={3}
                defaultSize={30}
                minSize={20}
                maxSize={46}
                className="min-w-0"
              >
                {agentRail(() => setAskOpen(false))}
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>

      {palette}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

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
