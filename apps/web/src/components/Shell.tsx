"use client";

import { useEffect, useState } from "react";
import {
  getDocument,
  listDocuments,
  me,
  saveAnnotation,
  search,
  type DocumentDetail,
  type LibraryItem,
  type Me,
} from "@/lib/api";
import { AskPane } from "./AskPane";
import { ListPane } from "./ListPane";
import { NavRail } from "./NavRail";
import { ReaderPane, type NewHighlight } from "./ReaderPane";
import { SignIn } from "./SignIn";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  const [askOpen, setAskOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    me().then(setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    listDocuments().then((docs) => {
      setItems(docs);
      setSelectedId((current) => current ?? docs[0]?.id ?? null);
    });
  }, [user]);

  useEffect(() => {
    if (selectedId == null) {
      setDoc(null);
      return;
    }
    let alive = true;
    getDocument(selectedId).then((d) => alive && setDoc(d));
    return () => {
      alive = false;
    };
  }, [selectedId]);

  // The search box: hybrid, falling back to literal text when no model is wired.
  useEffect(() => {
    if (!user) return;
    const q = query.trim();
    if (!q) {
      setSearching(false);
      listDocuments().then(setItems);
      return;
    }
    setSearching(true);
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const hits = await search(q, "hybrid").catch(() => search(q, "exact"));
        if (!alive) return;
        setItems(
          hits.map((hit) => ({
            id: hit.documentId,
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
    setDoc(await getDocument(selectedId));
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
      <div className="grid h-screen grid-cols-[64px_340px_1fr] overflow-hidden bg-background text-foreground">
        <NavRail view={view} onView={setView} />
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
        />
        <div className="flex min-w-0">
          <ReaderPane
            doc={doc}
            onHighlight={handleHighlight}
            askOpen={askOpen}
            onToggleAsk={() => setAskOpen((open) => !open)}
          />
          {askOpen ? <AskPane onClose={() => setAskOpen(false)} /> : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
