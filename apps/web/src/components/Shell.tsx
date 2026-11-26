"use client";

import { useEffect, useRef, useState } from "react";
import {
  addLink,
  getDocument,
  listDocuments,
  me,
  saveAnnotation,
  search,
  type DocumentDetail,
  type LibraryItem,
  type Me,
} from "@/lib/api";
import { RightPane } from "./RightPane";
import { ListPane } from "./ListPane";
import { NavRail } from "./NavRail";
import { ReaderPane, type NewHighlight } from "./ReaderPane";
import { SignIn } from "./SignIn";
import { TooltipProvider } from "@curio/ui/components/tooltip";

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
 * The shell: rail, list, reader, and the agent. It owns selection and which
 * panes are open, nothing else — every row of content comes from `/api`.
 */
export function Shell() {
  const [user, setUser] = useState<Me | null | undefined>(undefined);
  const [view, setView] = useState("library");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [askOpen, setAskOpen] = useState(true);
  const [focus, setFocus] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
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

  /** Warm the cache before the click lands, so opening is instant. */
  function prefetchDocument(id: number) {
    if (docCache.current.has(id)) return;
    getDocument(id)
      .then((d) => docCache.current.set(d.id, d))
      .catch(() => undefined);
  }

  // One effect owns the list — the unfiltered library, or the search results.
  // Two effects meant two identical requests on every load.
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

  async function handleHighlight(input: NewHighlight) {
    if (selectedId == null) return;
    await saveAnnotation(selectedId, { ...input, kind: "highlight" });
    await refreshDocument();
  }

  if (user === undefined) return null;
  if (!user) return <SignIn onDone={setUser} />;

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={[
          "grid h-screen overflow-hidden bg-background text-foreground",
          focus ? "grid-cols-[64px_1fr]" : "grid-cols-[64px_340px_1fr]",
        ].join(" ")}
      >
        <NavRail view={view} onView={setView} />
        {focus ? null : (
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
        )}
        <div className="flex min-w-0">
          <ReaderPane
            doc={doc}
            onHighlight={handleHighlight}
            askOpen={askOpen}
            onToggleAsk={() => setAskOpen((open) => !open)}
            onToggleFocus={() => setFocus((f) => !f)}
          />
          {askOpen ? (
            <RightPane
              doc={doc}
              onClose={() => setAskOpen(false)}
              onJumpToMark={(id) =>
                document
                  .querySelector(`mark[data-annotation-id="${id}"]`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            />
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
