"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@curio/ui/components/ui/resizable";
import { ShareQuoteDialog } from "@curio/ui/quote/dialog";
import { TooltipProvider } from "@curio/ui/components/ui/tooltip";
import type { CreatePayload } from "@curio/ui/components/highlight/highlight";
import {
  addLink,
  archiveDocument,
  deleteAnnotation,
  getDocument,
  listDocuments,
  markRead,
  me,
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
  });
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
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
      listDocuments({ state, sort }).then(({ documents, counts: c }) => {
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

  /** Re-read the list with the current filter, and keep the selection if it survived. */
  async function reload() {
    const { documents, counts: c } = await listDocuments({ state, sort });
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
                  sort={sort}
                  onState={setState}
                  onSort={setSort}
                  onSelect={setSelectedId}
                  query={query}
                  onQuery={setQuery}
                  onAddLink={handleAddLink}
                  onPrefetch={prefetchDocument}
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
              appearance={appearance}
              onAppearance={changeAppearance}
              askOpen={askOpen}
            />
          </ResizablePanel>

          {askOpen ? (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={46} className="min-w-0">
                <RightPane
                  doc={doc}
                  onClose={() => setAskOpen(false)}
                  onJumpToMark={(id) =>
                    document
                      .querySelector(`mark[data-annotation-id="${id}"]`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                />
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        documents={items}
        dark={dark}
        onOpenDocument={(id) => setSelectedId(id)}
        onSearch={() => {
          setFocus(false);
          document.querySelector<HTMLInputElement>('input[aria-label="Search this library"]')?.focus();
        }}
        onAddLink={() => {
          setFocus(false);
          document.querySelector<HTMLButtonElement>('button[aria-label="Add a link"]')?.click();
        }}
        onToggleAsk={() => setAskOpen((open) => !open)}
        onToggleFocus={() => setFocus((f) => !f)}
        onToggleTheme={() => {
          toggleTheme();
          setDark(isDark());
        }}
      />

      {/* The ported quote studio. Sharing a mark opens it with that quote. */}
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
