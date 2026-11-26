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
import { CommandPalette } from "./CommandPalette";
import { APPEARANCE_DEFAULT, type Appearance } from "./ReaderAppearance";
import { isDark, toggleTheme } from "@/lib/theme";
import { SignIn } from "./SignIn";

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
  const [user, setUser] = useState<Me | null | undefined>(undefined);
  const [view, setView] = useState("library");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [state, setState] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [counts, setCounts] = useState<LibraryCounts>({
    all: 0,
    unread: 0,
    reading: 0,
    read: 0,
    archived: 0,
    starred: 0,
  });
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isMobile = useIsMobile();
  const [dark, setDark] = useState(true);
  // Appearance sticks across articles, so it is set once.
  const [appearance, setAppearance] = useState<Appearance>(APPEARANCE_DEFAULT);

  // Documents already fetched. A second visit is instant, and a hover warms it.
  const docCache = useRef(new Map<number, DocumentDetail>());

  useEffect(() => {
    me().then(setUser);
    setDark(isDark());
    try {
      const stored = localStorage.getItem("curio-appearance");
      if (stored) setAppearance({ ...APPEARANCE_DEFAULT, ...(JSON.parse(stored) as Appearance) });
    } catch {
      // unreadable prefs: the defaults stand
    }
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
          void handleToggleFavorite();
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
  }, []);

  function changeAppearance(next: Appearance) {
    setAppearance(next);
    try {
      localStorage.setItem("curio-appearance", JSON.stringify(next));
    } catch {
      // private mode: the choice holds for this visit
    }
  }

  useEffect(() => {
    if (selectedId == null) {
      setDoc(null);
      return;
    }
    const cached = docCache.current.get(selectedId);
    if (cached) {
      setDoc(cached);
      return;
    }
    let alive = true;
    getDocument(selectedId).then((d) => {
      if (!alive) return;
      docCache.current.set(d.id, d);
      setDoc(d);
    });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  /** One effect owns the list — the unfiltered library, or the search results. */
  useEffect(() => {
    if (!user) return;
    const q = query.trim();
    let alive = true;

    if (!q) {
      setSearching(false);
      listDocuments(filterParams(state, sort)).then(({ documents, counts: c }) => {
        if (!alive) return;
        setItems(documents);
        setCounts(c);
        setSelectedId((current) => current ?? documents[0]?.id ?? null);
      });
      return () => {
        alive = false;
      };
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const hits = await search(q, "hybrid").catch(() => search(q, "exact"));
        if (!alive) return;
        setItems(
          hits.map((hit) => ({
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
          })),
        );
      } finally {
        if (alive) setSearching(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, user, state, sort]);

  function prefetchDocument(id: number) {
    if (docCache.current.has(id)) return;
    getDocument(id)
      .then((d) => docCache.current.set(d.id, d))
      .catch(() => undefined);
  }

  async function refreshDocument() {
    if (selectedId == null) return;
    const fresh = await getDocument(selectedId);
    docCache.current.set(fresh.id, fresh);
    setDoc(fresh);
  }

  /** "Starred" is a pseudo-state: it filters on the star, not on read_state. */
  function filterParams(current: string | undefined, order: "newest" | "oldest") {
    return current === "starred"
      ? { sort: order, favorite: true }
      : { sort: order, state: current };
  }

  /** Re-read the list with the current filter, and keep the selection if it survived. */
  async function reload() {
    const { documents, counts: c } = await listDocuments(filterParams(state, sort));
    setItems(documents);
    setCounts(c);
    setSelectedId((current) =>
      current && documents.some((d) => d.id === current) ? current : (documents[0]?.id ?? null),
    );
  }

  async function handleAddLink(url: string) {
    const created = await addLink(url);
    await reload();
    setSelectedId(created.id);
  }

  /** The Highlight component's write paths, wired to the API. */
  async function handleCreate(payload: CreatePayload): Promise<number | null> {
    if (selectedId == null) return null;
    const saved = await saveAnnotation(selectedId, { ...payload, kind: "highlight" });
    await refreshDocument();
    return saved.id;
  }

  async function handleArchive() {
    if (selectedId == null) return;
    await archiveDocument(selectedId);
    docCache.current.delete(selectedId);
    await reload();
  }

  async function handleMarkRead() {
    if (selectedId == null || !doc) return;
    await markRead(selectedId, doc.readState === "read" ? "unread" : "read");
    await refreshDocument();
    await reload();
  }

  async function handleToggleFavorite() {
    if (selectedId == null || !doc) return;
    await setFavorite(selectedId, !doc.favorite);
    await refreshDocument();
    await reload();
  }

  function handleRecolor(id: number, hue: number) {
    void recolorAnnotation(id, hue)
      .then(refreshDocument)
      .catch(() => undefined);
  }

  function handleDelete(id: number) {
    void deleteAnnotation(id)
      .then(refreshDocument)
      .catch(() => undefined);
  }


  const agentRail = (onClose: () => void) => (
    <RightPane
      doc={doc}
      onClose={onClose}
      onJumpToMark={(id) =>
        document
          .querySelector(`mark[data-annotation-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    />
  );

  /**
   * Mobile is a different app, not a narrower one. One column, list or reader,
   * with the agent as a sheet over it — three panes squeezed into 390px is not a
   * layout, it is a shrug.
   */
  if (isMobile) {
    const reading = doc !== null;
    return (
      <TooltipProvider delayDuration={250}>
        <div className="flex h-[100svh] flex-col overflow-hidden bg-background text-foreground">
          <div className="min-h-0 flex-1">
            {reading ? (
              <ReaderPane
                doc={doc}
                onCreate={handleCreate}
                onRecolor={handleRecolor}
                onDelete={handleDelete}
                onToggleAsk={() => setAskOpen(true)}
                onToggleFocus={() => setFocus((f) => !f)}
                onShareQuote={setShare}
                onArchive={handleArchive}
                onMarkRead={handleMarkRead}
                onToggleFavorite={handleToggleFavorite}
                appearance={appearance}
                onAppearance={changeAppearance}
                onBack={() => setSelectedId(null)}
                askOpen={askOpen}
              />
            ) : (
              <ListPane
                title={view === "search" ? "Search" : "Library"}
                items={items}
                counts={counts}
                selectedId={selectedId}
                state={state}
                onState={setState}
                onSelect={setSelectedId}
                query={query}
                onQuery={setQuery}
                onOpenPalette={() => setPaletteOpen(true)}
                onPrefetch={prefetchDocument}
                mode={view === "search" ? "search" : "library"}
                searching={searching}
              />
            )}
          </div>

          <nav className="flex shrink-0 items-stretch border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)]">
            <MobileTab
              icon={<Books className="h-5 w-5" />}
              label="Library"
              active={!reading && view !== "search"}
              onClick={() => {
                setSelectedId(null);
                setView("library");
              }}
            />
            <MobileTab
              icon={<MagnifyingGlass className="h-5 w-5" />}
              label="Search"
              active={!reading && view === "search"}
              onClick={() => {
                setSelectedId(null);
                setView("search");
              }}
            />
            <MobileTab
              icon={<Sparkle className="h-5 w-5" />}
              label="Ask"
              active={askOpen}
              onClick={() => setAskOpen(true)}
            />
            <MobileTab
              icon={<Sun className="h-5 w-5" />}
              label="Theme"
              active={false}
              onClick={() => {
                toggleTheme();
                setDark(isDark());
              }}
            />
          </nav>

          <Sheet open={askOpen} onOpenChange={setAskOpen}>
            <SheetContent side="bottom" className="h-[88svh] gap-0 p-0">
              <SheetTitle className="sr-only">Ask Curio</SheetTitle>
              {agentRail(() => setAskOpen(false))}
            </SheetContent>
          </Sheet>
        </div>

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

  if (user === undefined) return null;
  if (!user) return <SignIn onDone={setUser} />;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
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
                  onPrefetch={prefetchDocument}
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
              onMarkRead={handleMarkRead}
              onToggleFavorite={handleToggleFavorite}
              appearance={appearance}
              onAppearance={changeAppearance}
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
          document.querySelector<HTMLButtonElement>('button[aria-label="Add a link"]')?.click();
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
