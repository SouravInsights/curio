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
  me,
  recolorAnnotation,
  saveAnnotation,
  search,
  type DocumentDetail,
  type LibraryItem,
  type Me,
} from "@/lib/api";
import { ListPane } from "./ListPane";
import { NavRail } from "./NavRail";
import { ReaderPane } from "./ReaderPane";
import { RightPane } from "./RightPane";
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
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);

  // Documents already fetched. A second visit is instant, and a hover warms it.
  const docCache = useRef(new Map<number, DocumentDetail>());

  useEffect(() => {
    me().then(setUser);
  }, []);

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
      listDocuments().then((docs) => {
        if (!alive) return;
        setItems(docs);
        setSelectedId((current) => current ?? docs[0]?.id ?? null);
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
  }, [query, user]);

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

  async function handleAddLink(url: string) {
    const created = await addLink(url);
    const docs = await listDocuments();
    setItems(docs);
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
    const docs = await listDocuments();
    setItems(docs);
    setSelectedId(docs[0]?.id ?? null);
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
                  selectedId={selectedId}
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
