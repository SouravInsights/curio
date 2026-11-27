"use client";

import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@curio/ui/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@curio/ui/components/ui/resizable";
import { ShareQuoteDialog } from "@curio/ui/quote/dialog";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { Button } from "@curio/ui/components/button";
import { cn } from "@curio/ui/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@curio/ui/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@curio/ui/components/ui/sheet";
import { useIsMobile } from "@curio/ui/hooks/use-mobile";
import {
  Books,
  GearSix,
  Highlighter,
  MagnifyingGlass,
  SidebarSimple,
  Sparkle,
  Warning,
  X,
} from "@phosphor-icons/react";
import type { CreatePayload } from "@curio/ui/components/highlight/highlight";
import {
  type LibraryCounts,
  type LibraryItem,
} from "@/lib/api";
import { ListPane } from "./ListPane";
import { NavRail } from "./NavRail";
import { ReaderPane, ReaderToolbar } from "./ReaderPane";
import { RightPane } from "./RightPane";
import { HighlightsPane } from "./HighlightsPane";
import { TopicsPane } from "./TopicsPane";
import { SettingsPane } from "./SettingsPane";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { isDark, toggleTheme } from "@/lib/theme";
import { SHORTCUTS, keyFor } from "@/lib/shortcuts";
import { SignIn } from "./SignIn";
import { useQueryClient } from "@tanstack/react-query";
import { useUiState } from "@/lib/store";
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
  keys,
} from "@/lib/queries";

const EMPTY_COUNTS: LibraryCounts = { all: 0, unread: 0, reading: 0, read: 0, archived: 0, starred: 0 };

/** The icon rail's width, so panel defaults can be pinned to real pixels. */
const RAIL_WIDTH = 64;

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
  } = useUiState();

  const [sort] = useState<"newest" | "oldest">("newest");
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
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
  const selectedItem = items.find((item) => item.id === selectedId);
  const listLoading = query.trim()
    ? results.isLoading && !results.data
    : library.isLoading && !library.data;
  // While the first page loads, size the skeleton to the view we already know
  // about rather than drawing a fixed stack. A sidebar with two saved documents
  // should not pretend to have eight — and an Unread filter with three should
  // draw three, not the size of the whole library.
  const knownCounts =
    client.getQueriesData<{ counts: LibraryCounts }>({ queryKey: keys.libraries })[0]?.[1]?.counts;
  const knownCount = knownCounts
    ? state === "starred"
      ? knownCounts.starred
      : state
        ? knownCounts[state as keyof LibraryCounts]
        : knownCounts.all
    : 0;
  const skeletonCount = knownCount > 0 ? Math.min(knownCount, 8) : 2;

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
          toggleFocusMode();
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
  }, [selectedId, doc, items, focus, askOpen]);

  async function handleAddLink(url: string) {
    setAddError(null);
    setPendingUrl(url);
    try {
      const created = await addLink.mutateAsync(url);
      setSelectedId(created.id);
    } catch (error) {
      setAddError(
        error instanceof Error && error.message
          ? error.message
          : "Could not read that link. Check the address and try again.",
      );
    } finally {
      setPendingUrl(null);
    }
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

  /**
   * Focus mode: the pair of header triggers in one key. If either panel is
   * open, clear the decks; if neither is, bring the library back. The two
   * triggers still close one panel each — this is both at once, for the
   * keyboard and the palette.
   */
  function toggleFocusMode() {
    // `focus` true means the library is *hidden*, so "something is open" is
    // `!focus || askOpen`.
    if (!focus || askOpen) {
      setFocus(true);
      setAskOpen(false);
    } else {
      setFocus(false);
    }
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
        loading={listLoading}
        pendingUrl={pendingUrl}
        skeletonCount={skeletonCount}
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
      onToggleFocus={toggleFocusMode}
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
                onShareQuote={setShare}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                onMarkRead={handleMarkRead}
                onToggleFavorite={handleToggleFavorite}
                appearance={appearance}
                onAppearance={setAppearance}
                onBack={() => setSelectedId(null)}
                loading={opened.isLoading}
                pendingUrl={pendingUrl && !doc ? pendingUrl : null}
                loadingTitle={selectedItem?.title ?? selectedItem?.url ?? null}
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

        <AddErrorToast error={addError} onDismiss={() => setAddError(null)} />
      </TooltipProvider>
    );
  }

  const isSettings = view === "settings";

  /*
   * Panel sizes are percentages of the group, so one fixed default is only
   * right at one window width: 24% is 330px on a laptop and 660px on a large
   * display. Pin the two side panels to pixels and give the reader the rest, so
   * the list is always "just enough" and the agent rail has room for its tabs
   * and composer. The percentages are recomputed whenever the set of panels
   * changes, which is the same moment the group re-reads its defaults.
   */
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const groupWidth = Math.max(640, viewportWidth - RAIL_WIDTH);
  const pct = (px: number) => (px / groupWidth) * 100;
  const librarySize = Math.min(pct(320), 32);
  const agentSize = Math.min(pct(400), 34);
  const libraryShown = !focus && !isSettings;
  const agentShown = askOpen && !isSettings;
  const readerSize = 100 - (libraryShown ? librarySize : 0) - (agentShown ? agentSize : 0);

  return (
    <TooltipProvider delayDuration={250}>
      <SidebarProvider
        open={!focus}
        onOpenChange={(open) => setFocus(!open)}
        className="h-[100dvh] overflow-hidden bg-background text-foreground"
      >
        <NavRail view={view} onView={chooseView} />

        {/* The panels resize, so the reading column keeps the width you give
            it. Ids and order are explicit because panels mount and unmount as
            focus, Settings and the agent rail come and go — without them the
            group re-associates by registration index and a handle drives the
            wrong panel. */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {libraryShown ? (
            <>
              <ResizablePanel
                id="library"
                order={1}
                defaultSize={librarySize}
                minSize={14}
                maxSize={36}
                className="min-w-0"
              >
                {destination}
              </ResizablePanel>
              <ResizableHandle id="library-reader" withHandle />
            </>
          ) : null}

          <ResizablePanel
            id="reader"
            order={2}
            defaultSize={readerSize}
            minSize={28}
            className="min-w-0"
          >
            <div className="flex h-full min-h-0 flex-col">
              {/* The content header. The sidebar trigger lives here, not inside
                  the sidebar, so it is on screen whether the list is open or
                  shut — a control that hides itself with the thing it controls
                  cannot bring it back. */}
              <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                <div className="flex min-w-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarTrigger
                        aria-label={focus ? "Show library" : "Hide library"}
                        className="h-7 w-7 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {focus ? "Show library" : "Hide library"}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-2">
                  {!isSettings ? (
                    <ReaderToolbar
                      doc={doc}
                      onArchive={handleArchive}
                      onUnarchive={handleUnarchive}
                      onMarkRead={handleMarkRead}
                      onToggleFavorite={handleToggleFavorite}
                      appearance={appearance}
                      onAppearance={setAppearance}
                      onToggleFocus={toggleFocusMode}
                      focus={focus && !askOpen}
                    />
                  ) : null}

                  {/* The right panel's trigger, the mirror of the left one. It is
                      the only control that gets a divider: a panel toggle is a
                      different kind of thing from the document actions beside
                      it, and those actions are all peers. */}
                  {!isSettings ? (
                    <>
                      {doc ? (
                        <span aria-hidden="true" className="h-4 w-px bg-border" />
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={askOpen ? "Hide Curio" : "Ask Curio"}
                            aria-pressed={askOpen}
                            onClick={() => setAskOpen((open) => !open)}
                            className={cn(
                              "h-7 w-7 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                              askOpen && "bg-foreground/[0.08] text-foreground",
                            )}
                          >
                            <SidebarSimple className="-scale-x-100" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="flex items-center gap-2">
                          {askOpen ? "Hide Curio" : "Ask Curio"} <Kbd>{keyFor("ask")}</Kbd>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  ) : null}
                </div>
              </header>

              <div className="min-h-0 flex-1">
                {isSettings ? (
                  settings
                ) : (
                  <ReaderPane
                    doc={doc}
                    onCreate={handleCreate}
                    onRecolor={handleRecolor}
                    onDelete={handleDelete}
                    onShareQuote={setShare}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onMarkRead={handleMarkRead}
                    onToggleFavorite={handleToggleFavorite}
                    appearance={appearance}
                    onAppearance={setAppearance}
                    renderToolbar={false}
                    loading={opened.isLoading}
                    pendingUrl={pendingUrl && !doc ? pendingUrl : null}
                    loadingTitle={selectedItem?.title ?? selectedItem?.url ?? null}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          {agentShown ? (
            <>
              <ResizableHandle id="reader-agent" withHandle />
              <ResizablePanel
                id="agent"
                order={3}
                defaultSize={agentSize}
                minSize={20}
                maxSize={40}
                className="min-w-0"
              >
                {agentRail(() => setAskOpen(false))}
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </SidebarProvider>

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

      <AddErrorToast error={addError} onDismiss={() => setAddError(null)} />
    </TooltipProvider>
  );
}

/** The one failure the app cannot show in place: a link that could not be read. */
function AddErrorToast({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-popover px-3.5 py-2.5 text-foreground shadow-[var(--shadow-popover)]"
      >
        <Warning className="mt-0.5 h-4 w-4 flex-none text-destructive" />
        <p className="type-caption text-foreground">{error}</p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-1 grid h-5 w-5 flex-none place-items-center rounded-[var(--radius-control)] text-faint-foreground hover:bg-[var(--hover)] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
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
