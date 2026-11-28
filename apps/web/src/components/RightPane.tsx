import { useEffect, useRef, useState } from "react";
import { ArrowBendDownRight, ArrowSquareOut, Highlighter, PaperPlaneRight, X } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@curio/ui/components/ui/tabs";
import { Button } from "@curio/ui/components/ui/button";
import { Textarea } from "@curio/ui/components/ui/textarea";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/ui/tooltip";
import { HUES } from "@curio/ui/lib/highlight-palette";
import { keyFor } from "@/lib/shortcuts";
import { ask, type AgentSource } from "@/lib/api";
import { Markdown } from "./Markdown";
import type { LocalAnnotation } from "@/lib/local/db";
import type { ReaderDoc } from "@/lib/local/items";
import { useConnections, useThread } from "@/lib/queries";

const SUGGESTIONS = [
  "What is the argument in one paragraph?",
  "What does this disagree with that I have read?",
  "What should I read next on this?",
];

interface Turn {
  role: "user" | "assistant";
  text: string;
  sources?: AgentSource[];
}

/** The text of a stored UIMessage part list. */
function textOf(parts: unknown[]): string {
  return (parts as { type?: string; text?: string }[])
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

/**
 * Sources grouped by document, because a reader thinks per document: one title,
 * then the spans the agent drew from it. Each span is a doorway back into the
 * text, not a footnote.
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
  /** Open a connected document from the "More like this" tab. */
  onOpenDocument: (id: number) => void;
  /** Open a cited line span in the reader. */
  onOpenSource: (source: AgentSource) => void;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState("");
  const [sources, setSources] = useState<AgentSource[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
        .map((message) => ({
          role: message.role,
          text: textOf(message.parts),
        }))
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

    let answer = "";
    let found: AgentSource[] = [];
    try {
      await ask(doc.id, q, {
        onDelta: (delta) => {
          answer += delta;
          setStreaming(answer);
        },
        onSources: (next) => {
          found = next;
          setSources(next);
        },
      });
      setTurns((prev) => [...prev, { role: "assistant", text: answer, sources: found }]);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Something went wrong.") +
          " — the agent needs a model key (or the Sprite gateway).",
      );
    } finally {
      setStreaming("");
      setBusy(false);
    }
  }

  const tabClass =
    "rounded-[var(--radius-control)] px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none";

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-sidebar">
      <Tabs defaultValue="coreader" className="flex h-full min-h-0 flex-col gap-0">
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
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
              <TabsTrigger value="coreader" className={tabClass}>
                Co-Reader
              </TabsTrigger>
              <TabsTrigger value="notebook" className={tabClass}>
                Notebook
              </TabsTrigger>
              <TabsTrigger value="related" className={tabClass}>
                More like this
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="coreader" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div className="scroll-contain min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <h2 className="type-label mb-2.5">Summary</h2>
            {doc?.summary ? (
              <p className="type-body text-muted-foreground">{doc.summary}</p>
            ) : (
              <p className="type-caption">
                No summary yet. It is written when the document is read through the pipeline.
              </p>
            )}

            {turns.length || streaming ? (
              <div className="mt-6 flex flex-col gap-5 border-t border-border pt-5">
                {turns.map((turn, index) =>
                  turn.role === "user" ? (
                    <p
                      key={index}
                      className="self-end rounded-[var(--radius-card)] bg-foreground/[0.05] px-3 py-2 type-body text-foreground"
                    >
                      {turn.text}
                    </p>
                  ) : (
                    <Answer key={index} text={turn.text} sources={turn.sources ?? []} onOpenSource={onOpenSource} />
                  ),
                )}
                {streaming ? <Answer text={streaming} sources={sources} onOpenSource={onOpenSource} /> : null}
              </div>
            ) : null}

            {error ? <p className="type-caption mt-3 text-destructive">{error}</p> : null}
          </div>

          <div className="shrink-0 border-t border-border p-3">
            {turns.length === 0 && !streaming ? (
              <ul className="mb-3 flex flex-col">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => void send(s)}
                      className="flex w-full items-start gap-2 rounded-[var(--radius-row)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
                    >
                      <ArrowBendDownRight className="mt-[3px] h-3.5 w-3.5 flex-none text-faint-foreground" />
                      <span className="type-caption text-muted-foreground">{s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Textarea
                rows={1}
                value={question}
                placeholder="Ask anything about this article…"
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                className="min-h-10 resize-none rounded-[var(--radius-pill)] px-3.5"
              />
              <Button
                type="submit"
                size="icon"
                disabled={busy || !question.trim()}
                aria-label="Send"
                className="h-10 w-10 flex-none rounded-full"
              >
                <PaperPlaneRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="notebook" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <h2 className="type-label mb-3">
            {annotations.length} Highlight{annotations.length === 1 ? "" : "s"}
          </h2>
          {!annotations.length ? (
            <p className="type-caption">
              Select a line in the article, then pick a colour. Marks are kept and shown to anyone
              who opens this article.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {annotations.map((mark) => (
                <li
                  key={mark.clientId}
                  className="rounded-[var(--radius-card)] border border-border/60 p-3"
                >
                  <span
                    aria-hidden="true"
                    className="mb-2 block h-0.5 w-6 rounded-full"
                    style={{ backgroundColor: HUES[mark.hue]?.swatch }}
                  />
                  <button
                    onClick={() => onJumpToMark(mark.clientId)}
                    className="type-body text-left text-foreground hover:underline"
                  >
                    {mark.quote}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {annotations.length ? (
            <p className="type-caption mt-6 flex items-center gap-1.5 text-faint-foreground">
              <Highlighter className="h-3.5 w-3.5" /> Click a mark to jump to it.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="related" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <h2 className="type-label mb-3">More like this</h2>
          {related.data?.documents.length ? (
            <ul className="flex flex-col gap-2">
              {related.data.documents.map((other) => (
                <li key={other.id}>
                  <button
                    onClick={() => onOpenDocument(other.id)}
                    className="flex w-full items-start gap-2 rounded-[var(--radius-row)] px-2 py-2 text-left transition-colors hover:bg-[var(--hover)]"
                  >
                    <ArrowBendDownRight className="mt-[3px] h-3.5 w-3.5 flex-none text-faint-foreground" />
                    <span className="type-body line-clamp-3 text-foreground">
                      {other.title || other.url || "Untitled"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-caption">
              Nothing connected yet. Ask the agent to compare this with something else you have
              read — the edge it records shows up here.
            </p>
          )}
          {doc?.url ? (
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="type-caption mt-5 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" /> Open the original
            </a>
          ) : null}
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
  if (!text && !sources.length) {
    return <p className="type-body text-muted-foreground">Searching the library…</p>;
  }
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
            {groupSources(sources).map((group) => (
              <li key={group.documentId} className="flex flex-col gap-0.5">
                <span className="type-caption truncate px-2 text-foreground">
                  {group.title || `Document ${group.documentId}`}
                </span>
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
