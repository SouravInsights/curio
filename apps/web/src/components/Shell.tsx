"use client";

import { useEffect, useRef, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@curio/ui/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@curio/ui/components/ui/resizable";
import { ShareQuoteDialog } from "@curio/ui/quote/dialog";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { Button } from "@curio/ui/components/button";
import { Curio } from "@curio/ui/components/curio/mascot";
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
import type { AgentSource } from "@/lib/api";
import { ListPane } from "./ListPane";
import { NavRail } from "./NavRail";
import { MobileReaderHeader, ReaderPane, ReaderToolbar } from "./ReaderPane";
import { RightPane } from "./RightPane";
import { HighlightsPane } from "./HighlightsPane";
import { ReviewPane } from "./ReviewPane";
import { ChatsPane } from "./curio/ChatsPane";
import { CurioChat } from "./curio/CurioChat";
import { TopicsPane } from "./TopicsPane";
import { SettingsPane } from "./SettingsPane";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { isDark, toggleTheme } from "@/lib/theme";
import { SHORTCUTS, keyFor } from "@/lib/shortcuts";
import { SignIn } from "./SignIn";
import { useQueryClient } from "@tanstack/react-query";
import { useUiState } from "@/lib/store";
import { useAddLink, useMe, useSearchResults } from "@/lib/queries";
import { useLocal } from "@/lib/local/provider";
import { useBody, prefetchBody } from "@/lib/local/content";
import {
  createMark,
  recolorMark,
  removeMark,
  useDocumentMarks,
} from "@/lib/local/annotations";
import {
  patchItem,
  toReaderDoc,
  useItem,
  useLibraryCounts,
  useLibraryItems,
} from "@/lib/local/items";

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
    curioThreadId,
    setCurioThreadId,
    appearance,
    setAppearance,
  } = useUiState();

  const [sort] = useState<"newest" | "oldest">("newest");
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [dark, setDark] = useState(true);
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  const [jumpToLine, setJumpToLine] = useState<{ documentId: number; startLine: number } | null>(
    null,
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const isMobile = useIsMobile();

  // Server state: search and the agent, which have no local copy. Everything
  // the reader owns — the library list, read state, marks — is local-first.
  const client = useQueryClient();
  const account = useMe();
  const user = account.data;
  const signedIn = user != null;
  const results = useSearchResults(query, signedIn);

  const addLink = useAddLink();
  // Local truth: the list, the marks, and the outbox they write through. The
  // document body is the one thing cached separately.
  const { db, sync, content } = useLocal();
  const marks = useDocumentMarks(db, selectedId);
  const localItem = useItem(db, selectedId);
  const localItems = useLibraryItems(db, filterParams(state, sort));
  const counts = useLibraryCounts(db);
  const { markdown, loading: bodyLoading, error: bodyError } = useBody(content, selectedId);
  // The reader renders from the local row plus the cached body — no fetch on
  // open. The row is there from the list; the body is hot, on disk, or fetched.
  const doc = localItem ? toReaderDoc(localItem, markdown) : null;
  const prefetch = (id: number) => prefetchBody(content, id);
  const readerLoading = localItem === undefined;

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
        readState: "",
        favorite: false,
        readProgress: 0,
        lastReadAt: null,
        summary: null,
        topics: null,
        addedAt: "",
        wordCount: null,
      }))
    : (localItems ?? []).map((row) => ({
        id: row.id,
        externalId: row.externalId,
        title: row.title,
        url: row.url,
        site: row.site,
        author: row.author,
        kind: row.kind,
        readState: row.readState,
        favorite: row.favorite,
        readProgress: row.readProgress,
        lastReadAt: row.lastReadAt ? new Date(row.lastReadAt).toISOString() : null,
        summary: row.summary,
        topics: row.topics,
        wordCount: row.wordCount,
        addedAt: new Date(row.addedAt).toISOString(),
      }));
  const searching = results.isFetching;
  const selectedItem = items.find((item) => item.id === selectedId);
  const listLoading = query.trim() ? results.isLoading && !results.data : localItems === undefined;
  // Size the loading skeleton to the view we already have counts for rather
  // than drawing a fixed stack; an Unread filter with three draws three.
  const knownCount =
    state === "starred" ? counts.starred : state ? counts[state as keyof LibraryCounts] : counts.all;
  const skeletonCount = listLoading ? (knownCount > 0 ? Math.min(knownCount, 8) : 2) : 0;

  useEffect(() => {
    setDark(isDark());
  }, []);

  // A citation on the full-screen /curio page opens the reader here, at the
  // line. The params are read once and dropped, so a reload does not re-jump.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const doc = Number(params.get("doc"));
    const line = Number(params.get("line"));
    if (!Number.isInteger(doc) || doc <= 0) return;
    setSelectedId(doc);
    if (Number.isInteger(line) && line > 0) {
      setJumpToLine({ documentId: doc, startLine: line });
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  /**
   * Jumping to a mark. The highlight engine rebuilds the mark DOM after the
   * article mounts, so the target is not there on the first frame; this retries
   * until it is, or gives up. `[data-hl]` is the attribute the engine paints.
   */
  useEffect(() => {
    if (jumpTo == null || !doc) return;
    let cancelled = false;
    const target = jumpTo;
    const started = performance.now();
    function attempt() {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-hl-row="${target}"]`);
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

  /**
   * Jumping to a cited line. The reader's markdown carries the source line range
   * on every block (`data-line-start`), so the target is the block whose range
   * contains the line — or the last block before it. Flash, then forget.
   */
  useEffect(() => {
    if (!jumpToLine || !doc || doc.id !== jumpToLine.documentId) return;
    let cancelled = false;
    const target = jumpToLine.startLine;
    const started = performance.now();
    function attempt() {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>("[data-reader]");
      const blocks = root
        ? Array.from(root.querySelectorAll<HTMLElement>("[data-line-start]"))
        : [];
      let best: HTMLElement | null = null;
      for (const el of blocks) {
        const start = Number(el.dataset.lineStart);
        const end = Number(el.dataset.lineEnd ?? el.dataset.lineStart);
        if (Number.isNaN(start) || start > target) break;
        best = el;
        if (target <= end) break;
      }
      if (best) {
        best.scrollIntoView({ behavior: "smooth", block: "center" });
        best.classList.add("curio-cite-flash");
        window.setTimeout(() => best?.classList.remove("curio-cite-flash"), 1500);
        setJumpToLine(null);
        return;
      }
      if (performance.now() - started < 2000) requestAnimationFrame(attempt);
      else setJumpToLine(null);
    }
    const raf = requestAnimationFrame(attempt);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [doc, jumpToLine]);

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
        case "review":
          chooseView("review");
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
      void sync?.run(); // the new document has to land in the local list
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

  async function handleCreate(payload: CreatePayload): Promise<string | null> {
    if (selectedId == null || !db || !sync) return null;
    return createMark(db, sync, { ...payload, documentId: selectedId, kind: "highlight" });
  }

  function handleToggleFavorite() {
    if (!doc || !db || !sync) return;
    void patchItem(db, sync, doc.id, { favorite: !doc.favorite });
  }

  function handleMarkRead() {
    if (!doc || !db || !sync) return;
    void patchItem(db, sync, doc.id, { readState: doc.readState === "read" ? "unread" : "read" });
  }

  function handleArchive() {
    if (selectedId == null || !db || !sync) return;
    // The row leaves the list on the next tick; move the selection off it first.
    setSelectedId(items.find((row) => row.id !== selectedId)?.id ?? null);
    void patchItem(db, sync, selectedId, { readState: "archived" });
  }

  function handleUnarchive() {
    if (selectedId == null || !db || !sync) return;
    void patchItem(db, sync, selectedId, { readState: "unread" });
  }

  function handleRecolor(clientId: string, hue: number) {
    if (!db || !sync) return;
    void recolorMark(db, sync, clientId, hue);
  }

  function handleDelete(clientId: string) {
    if (!db || !sync) return;
    void removeMark(db, sync, clientId);
  }

  /** Open a document and scroll to one of its marks. */
  function openMark(documentId: number, clientId: string) {
    setSelectedId(documentId);
    setJumpTo(clientId);
  }

  /** Open the document an agent citation points at, at the exact lines. */
  function openSource(source: AgentSource) {
    setSelectedId(source.documentId);
    setJumpToLine({ documentId: source.documentId, startLine: source.startLine });
  }

  /** A citation in the full-width Curio chat: leave the chat, open the reader. */
  function openFromChat(source: AgentSource) {
    setView("library");
    openSource(source);
  }

  // Progress writes are cheap but frequent; coalesce a burst of scroll into one
  // local write + patch, and let the first scroll mark an unread piece "reading".
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressValue = useRef(0);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  function handleProgress(percent: number) {
    progressValue.current = percent;
    if (progressTimer.current) return;
    progressTimer.current = setTimeout(() => {
      progressTimer.current = null;
      const id = selectedRef.current;
      if (id == null || !db || !sync) return;
      void (async () => {
        const item = await db.items.get(id);
        const patch: { readProgress: number; readState?: string } = {
          readProgress: progressValue.current,
        };
        if (item && item.readState === "unread" && progressValue.current > 2) {
          patch.readState = "reading";
        }
        await patchItem(db, sync, id, patch);
      })();
    }, 2500);
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
      annotations={marks}
      onClose={onClose}
      onJumpToMark={(clientId) => setJumpTo(clientId)}
      onOpenDocument={(id) => setSelectedId(id)}
      onOpenSource={openSource}
    />
  );

  /** The left column, by destination. */
  const destination =
    view === "highlights" ? (
      <HighlightsPane onOpen={openMark} />
    ) : view === "review" ? (
      <ReviewPane onOpen={openMark} />
    ) : view === "curio" ? (
      <ChatsPane
        selectedId={curioThreadId}
        onSelect={setCurioThreadId}
        onNew={() => setCurioThreadId(null)}
      />
    ) : view === "topics" ? (
      <TopicsPane
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

  /** The palette, mounted for both layouts. */
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

  // The session check gates everything below it, so its three states are
  // distinct: in flight, unreachable, signed out.
  if (account.isError) return <ConnectError onRetry={() => void account.refetch()} />;
  if (user === undefined) return <Connecting />;
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
            ) : view === "curio" ? (
              <div className="flex h-full min-h-0 flex-col">
                <header className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                  <h1 className="type-heading truncate">Ask Curio</h1>
                </header>
                <div className="min-h-0 flex-1">
                  <CurioChat
                    threadId={curioThreadId}
                    onNew={() => setCurioThreadId(null)}
                    onThreadCreated={setCurioThreadId}
                    onOpenSource={openFromChat}
                  />
                </div>
              </div>
            ) : reading ? (
              <div className="flex h-full min-h-0 flex-col">
                <MobileReaderHeader
                  doc={doc}
                  onBack={() => setSelectedId(null)}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  onMarkRead={handleMarkRead}
                  onToggleFavorite={handleToggleFavorite}
                  onAsk={() => setAskOpen(true)}
                  appearance={appearance}
                  onAppearance={setAppearance}
                />
                <div className="min-h-0 flex-1">
                  <ReaderPane
                    doc={doc}
                    annotations={marks}
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
                    loading={readerLoading}
                    bodyLoading={bodyLoading}
                    bodyError={bodyError}
                    pendingUrl={pendingUrl && !doc ? pendingUrl : null}
                    loadingTitle={selectedItem?.title ?? selectedItem?.url ?? null}
                    onProgress={handleProgress}
                  />
                </div>
              </div>
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
              active={view === "curio"}
              onClick={() => {
                setSelectedId(null);
                chooseView("curio");
              }}
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
          source={doc?.site || doc?.url || ""}
        />

        <AddErrorToast error={addError} onDismiss={() => setAddError(null)} />
      </TooltipProvider>
    );
  }

  const isSettings = view === "settings";
  const isCurio = view === "curio";

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
  const agentShown = askOpen && !isSettings && !isCurio;
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
              <header className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
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
                  {!isSettings && !isCurio ? (
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
                  {!isSettings && !isCurio ? (
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
                ) : isCurio ? (
                  <CurioChat
                    threadId={curioThreadId}
                    onNew={() => setCurioThreadId(null)}
                    onThreadCreated={setCurioThreadId}
                    onOpenSource={openFromChat}
                  />
                ) : (
                  <ReaderPane
                    doc={doc}
                    annotations={marks}
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
                    loading={readerLoading}
                    bodyLoading={bodyLoading}
                    bodyError={bodyError}
                    pendingUrl={pendingUrl && !doc ? pendingUrl : null}
                    loadingTitle={selectedItem?.title ?? selectedItem?.url ?? null}
                    onProgress={handleProgress}
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
        source={doc?.site || doc?.url || ""}
      />

      <AddErrorToast error={addError} onDismiss={() => setAddError(null)} />
    </TooltipProvider>
  );
}

/** The session check is in flight. A surface in the app's own background. */
function Connecting() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="text-green-600 dark:text-green-500">
        <Curio size={30} still />
      </div>
    </div>
  );
}

/** The session check failed — the API did not answer. */
function ConnectError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">
        <p className="type-heading">Curio did not answer</p>
        <p className="type-caption text-muted-foreground">
          The server could not be reached. Check your connection, then try again.
        </p>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

/** The one failure the app cannot show in place: a link that could not be read. */
function AddErrorToast({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-[var(--radius-card)] bg-popover px-3.5 py-2.5 text-foreground shadow-float"
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
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors active:bg-sidebar-accent",
        active ? "text-foreground" : "text-faint-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
