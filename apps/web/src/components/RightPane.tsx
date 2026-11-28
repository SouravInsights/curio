"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowBendDownRight,
  CaretRight,
  Highlighter,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@curio/ui/components/ui/tabs";
import { Button } from "@curio/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@curio/ui/components/ui/collapsible";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/ui/tooltip";
import { Curio } from "@curio/ui/components/curio/mascot";
import { HUES } from "@curio/ui/lib/highlight-palette";
import { useQueryClient } from "@tanstack/react-query";
import { keyFor } from "@/lib/shortcuts";
import { ask, type AgentSource } from "@/lib/api";
import { Markdown } from "./Markdown";
import { CurioComposer } from "./curio/CurioComposer";
import type { LocalAnnotation } from "@/lib/local/db";
import type { ReaderDoc } from "@/lib/local/items";
import { useConnections, useThread } from "@/lib/queries";

interface Turn {
  role: "user" | "assistant";
  text: string;
  sources?: AgentSource[];
}

/** How an edge reads in the list. The raw kind is the data; this is the word. */
const CONNECTION_LABEL: Record<string, string> = {
  agrees: "Agrees",
  contradicts: "Contradicts",
  extends: "Extends",
  references: "References",
  related: "Related",
};

/** The text of a stored UIMessage part list. */
function textOf(parts: unknown[]): string {
  return (parts as { type?: string; text?: string }[])
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

/**
 * The ways in, for this piece. Derived from the document rather than a fixed
 * list, so the first question is about what is on the page — the first topic the
 * describe step wrote, when there is one.
 */
function suggestionsFor(doc: ReaderDoc): string[] {
  const topic = doc.topics?.[0];
  return [
    "What is the argument, in a few lines?",
    topic ? `What does this say about ${topic}?` : "What are the key claims?",
    "How does this connect to what I have read?",
  ];
}

/**
 * Sources grouped by document. A citation is a span in something the reader
 * owns, and the group title is only worth the line when the agent cited more
 * than one piece — in the co-reader it is usually this document, whose title is
 * already on screen.
 */
function groupSources(sources: AgentSource[]) {
  const groups = new Map<number, { documentId: number; title: string; spans: AgentSource[] }>();
  for (const source of sources) {
    let group = groups.get(source.documentId);
    if (!group) {
      group = { documentId: source.documentId, title: source.title, spans: [] };
      groups.set(source.documentId, group);
    }
    group.spans.push(source);
  }
  return [...groups.values()];
}

/**
 * The right rail: the agent and the marks, next to the text they are about.
 *
 * The co-reader is a conversation, not a search box. The thread is persisted per
 * document, so the answer you got yesterday is still here today, and the agent
 * reads the whole exchange back on the next turn.
 */
export function RightPane({
  doc,
  annotations,
  onClose,
  onJumpToMark,
  onOpenDocument,
  onOpenSource,
}: {
  doc: ReaderDoc | null;
  /** The document's marks, read from the local store. */
  annotations: LocalAnnotation[];
  onClose: () => void;
  onJumpToMark: (clientId: string) => void;
  /** Open a connected document. */
  onOpenDocument: (id: number) => void;
  /** Open a cited line span in the reader. */
  onOpenSource: (source: AgentSource) => void;
}) {
  const client = useQueryClient();
  const [tab, setTab] = useState("ask");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState("");
  const [sources, setSources] = useState<AgentSource[]>([]);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const related = useConnections(doc?.id ?? null);
  const thread = useThread(doc?.id ?? null);

  // Seed the conversation from the stored thread once per document. Live turns
  // are appended locally, so the refetch cannot duplicate them.
  const loadedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!doc || loadedFor.current === doc.id || thread.data === undefined) return;
    loadedFor.current = doc.id;
    setTurns(
      thread.data.messages
        .map((message) => ({ role: message.role, text: textOf(message.parts) }))
        .filter((turn) => turn.text),
    );
  }, [doc, thread.data]);

  async function send(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy || !doc) return;
    setBusy(true);
    setError("");
    setStreaming("");
    setSources([]);
    setQuestion("");
    setTurns((prev) => [...prev, { role: "user", text: q }]);

    const abort = new AbortController();
    controller.current = abort;
    let answer = "";
    let found: AgentSource[] = [];

    try {
      await ask({ documentId: doc.id }, q, {
        signal: abort.signal,
        onDelta: (delta) => {
          answer += delta;
          setStreaming(answer);
        },
        onSources: (next) => {
          found = next;
          setSources(next);
        },
        onPhase: setPhase,
      });
      setTurns((prev) => [...prev, { role: "assistant", text: answer, sources: found }]);
      // The turn may have drawn an edge; the Connections tab should see it.
      void client.invalidateQueries({ queryKey: ["connections", doc.id] });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(
          (e instanceof Error ? e.message : "Something went wrong.") +
            " — the agent needs a model key (or the Sprite gateway).",
        );
      }
    } finally {
      setStreaming("");
      setSources([]);
      setPhase(null);
      setBusy(false);
      controller.current = null;
    }
  }

  function stop() {
    controller.current?.abort();
  }

  /** The empty Connections tab's one action: ask for the edges. */
  function findConnections() {
    setTab("ask");
    void send(
      "What in my library agrees with, contradicts, or extends this piece? Read both sides and record the strongest edges.",
    );
  }

  const edges = related.data?.edges ?? [];
  const connected = related.data?.documents ?? [];
  const tabClass =
    "rounded-[var(--radius-control)] px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none";

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-sidebar">
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <div className="header-bar flex shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close panel" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex items-center gap-2">
                Close panel <Kbd>{keyFor("rail")}</Kbd>
              </TooltipContent>
            </Tooltip>
            <TabsList className="h-auto gap-0.5 bg-transparent p-0">
              <TabsTrigger value="ask" className={tabClass}>
                Ask
              </TabsTrigger>
              <TabsTrigger value="marks" className={tabClass}>
                Marks
              </TabsTrigger>
              <TabsTrigger value="connections" className={tabClass}>
                Connections
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="ask" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div className="scroll-contain min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {doc?.summary ? (
              <Collapsible className="mb-5">
                <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-[var(--radius-row)] py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                  <CaretRight className="h-3 w-3 flex-none text-faint-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <span className="type-label">About this piece</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="type-body mt-2 text-muted-foreground">{doc.summary}</p>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            {turns.length || streaming || busy ? (
              <div className="flex flex-col gap-5">
                {turns.map((turn, index) =>
                  turn.role === "user" ? (
                    <p
                      key={index}
                      className="self-end rounded-[var(--radius-card)] bg-foreground/[0.05] px-3 py-2 type-body text-foreground"
                    >
                      {turn.text}
                    </p>
                  ) : (
                    <Answer
                      key={index}
                      text={turn.text}
                      sources={turn.sources ?? []}
                      onOpenSource={onOpenSource}
                    />
                  ),
                )}
                {streaming ? (
                  <Answer text={streaming} sources={sources} onOpenSource={onOpenSource} />
                ) : null}
                {busy && !streaming ? (
                  <div className="flex items-center gap-2 text-faint-foreground">
                    <Curio size={18} busy />
                    <span className="type-caption">{phase ?? "Thinking…"}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="type-caption mt-3 text-destructive">{error}</p> : null}
          </div>

          <div className="shrink-0 border-t border-border p-3">
            {doc && turns.length === 0 && !streaming && !busy ? (
              <ul className="mb-3 flex flex-col">
                {suggestionsFor(doc).map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      onClick={() => void send(suggestion)}
                      className="flex w-full items-start gap-2 rounded-[var(--radius-row)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
                    >
                      <ArrowBendDownRight className="mt-[3px] h-3.5 w-3.5 flex-none text-faint-foreground" />
                      <span className="type-caption text-muted-foreground">{suggestion}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <CurioComposer
              value={question}
              onChange={setQuestion}
              onSubmit={send}
              onStop={stop}
              busy={busy}
              placeholder="Ask about this piece, or anything you have read…"
            />
          </div>
        </TabsContent>

        <TabsContent value="marks" className="mt-0 min-h-0 flex-1 overflow-y-auto p-1 pb-6">
          {annotations.length ? (
            <ul className="flex flex-col gap-1">
              {annotations.map((mark) => (
                <li key={mark.clientId}>
                  <button onClick={() => onJumpToMark(mark.clientId)} className="list-row text-left">
                    <span className="flex w-full items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 flex-none rounded-full"
                        style={{ backgroundColor: HUES[mark.hue]?.swatch }}
                      />
                      <span className="type-meta text-faint-foreground">
                        {mark.kind === "note" ? "Note" : "Highlight"}
                      </span>
                      <Highlighter className="ml-auto h-3.5 w-3.5 flex-none text-faint-foreground" />
                    </span>
                    {mark.quote ? (
                      <span className="type-body line-clamp-3 border-l-2 border-border pl-3 text-foreground">
                        {mark.quote}
                      </span>
                    ) : null}
                    {mark.body ? (
                      <span className="type-caption line-clamp-3 pl-3 text-muted-foreground">
                        {mark.body}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-caption px-3 py-6">
              No marks yet. Select a line in the piece, then pick a colour — it collects here, and
              it comes back for review.
            </p>
          )}
        </TabsContent>

        <TabsContent value="connections" className="mt-0 min-h-0 flex-1 overflow-y-auto p-1 pb-6">
          {edges.length ? (
            <ul className="flex flex-col gap-1">
              {edges.map((edge) => {
                const otherId =
                  edge.fromDocumentId === doc?.id ? edge.toDocumentId : edge.fromDocumentId;
                const other = connected.find((row) => row.id === otherId);
                if (!other) return null;
                return (
                  <li key={edge.id}>
                    <button onClick={() => onOpenDocument(other.id)} className="list-row text-left">
                      <span className="flex w-full items-center gap-2">
                        <span className="type-label flex-none text-faint-foreground">
                          {CONNECTION_LABEL[edge.kind] ?? edge.kind}
                        </span>
                        <ArrowBendDownRight className="ml-auto h-3.5 w-3.5 flex-none text-faint-foreground" />
                      </span>
                      <span className="type-body line-clamp-2 text-foreground">
                        {other.title || other.url || "Untitled"}
                      </span>
                      {edge.note ? (
                        <span className="type-caption line-clamp-3 text-muted-foreground">
                          {edge.note}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3 px-3 py-6">
              <p className="type-caption">
                Nothing connected yet. Curio reads both pieces and records how they relate — what
                agrees, what contradicts, what extends.
              </p>
              <Button variant="outline" size="sm" onClick={findConnections}>
                <Sparkle className="h-4 w-4" />
                Find connections
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

/** One answer, rendered as chrome-sized markdown, with its sources. */
function Answer({
  text,
  sources,
  onOpenSource,
}: {
  text: string;
  sources: AgentSource[];
  onOpenSource: (source: AgentSource) => void;
}) {
  const groups = groupSources(sources);
  const named = groups.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {text ? (
        <div className="answer-prose prose prose-sm prose-neutral dark:prose-invert">
          <Markdown anchors={false}>{text}</Markdown>
        </div>
      ) : null}
      {sources.length ? (
        <div>
          <h3 className="type-label mb-3">Sources</h3>
          <ul className="flex flex-col gap-4">
            {groups.map((group) => (
              <li key={group.documentId} className="flex flex-col gap-0.5">
                {named ? (
                  <span className="type-caption fade-truncate px-2 text-foreground">
                    {group.title || `Document ${group.documentId}`}
                  </span>
                ) : null}
                {group.spans.map((span) => (
                  <button
                    key={`${span.documentId}:${span.startLine}:${span.endLine}`}
                    onClick={() => onOpenSource(span)}
                    className="group flex w-full items-baseline gap-2 rounded-[var(--radius-row)] px-2 py-1.5 text-left transition-colors hover:bg-foreground/5"
                  >
                    <span className="flex-none text-[11px] tabular-nums text-faint-foreground transition-colors group-hover:text-muted-foreground">
                      {span.startLine > 0 ? `${span.startLine}–${span.endLine}` : "—"}
                    </span>
                    <span className="type-caption line-clamp-2 text-muted-foreground transition-colors group-hover:text-foreground">
                      {span.snippet || "Open this passage"}
                    </span>
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
