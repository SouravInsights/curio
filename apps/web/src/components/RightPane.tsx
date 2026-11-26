import { useState } from "react";
import { ArrowBendDownRight, Highlighter, PaperPlaneRight, X } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@curio/ui/components/ui/tabs";
import { Button } from "@curio/ui/components/ui/button";
import { Textarea } from "@curio/ui/components/ui/textarea";
import { HUES } from "@curio/ui/lib/highlight-palette";
import { ask, type DocumentDetail } from "@/lib/api";

const SUGGESTIONS = [
  "What is the argument in one paragraph?",
  "What does this disagree with that I have read?",
  "What should I read next on this?",
];

/**
 * The right rail: the agent and the marks, next to the text they are about.
 *
 * `h-full` matters — inside a `ResizablePanel` the panel gives the height, and
 * without it this column sizes to its content and the surface stops partway
 * down. Tabs are text-only with the active one on a raised chip: no underline,
 * no divider.
 */
export function RightPane({
  doc,
  onClose,
  onJumpToMark,
}: {
  doc: DocumentDetail | null;
  onClose: () => void;
  onJumpToMark: (id: number) => void;
}) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    setAsked(q);
    setQuestion("");
    try {
      await ask(q, (delta) => setAnswer((prev) => prev + delta));
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Something went wrong.") +
          " — the agent needs a model key (or the Sprite gateway).",
      );
    } finally {
      setBusy(false);
    }
  }

  const tabClass =
    "rounded-[var(--radius-control)] px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none";

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-border bg-sidebar">
      <Tabs defaultValue="coreader" className="flex h-full min-h-0 flex-col gap-0">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-2">
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
          <Button variant="ghost" size="icon-sm" aria-label="Close panel" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
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

            {asked ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="type-heading mb-2">{asked}</p>
                {answer ? (
                  <p className="type-body whitespace-pre-wrap text-muted-foreground">{answer}</p>
                ) : null}
                {busy && !answer ? (
                  <p className="type-body text-muted-foreground">Searching the library…</p>
                ) : null}
                {error ? <p className="type-caption mt-2 text-destructive">{error}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border p-3">
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
            {doc?.annotations.length ?? 0} Highlight{(doc?.annotations.length ?? 0) === 1 ? "" : "s"}
          </h2>
          {!doc?.annotations.length ? (
            <p className="type-caption">
              Select a line in the article, then pick a colour. Marks are kept and shown to anyone
              who opens this article.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {doc.annotations.map((mark) => (
                <li
                  key={mark.id}
                  className="rounded-[var(--radius-card)] border border-border/60 p-3"
                >
                  <span
                    aria-hidden="true"
                    className="mb-2 block h-0.5 w-6 rounded-full"
                    style={{ backgroundColor: HUES[mark.hue]?.swatch }}
                  />
                  <button
                    onClick={() => onJumpToMark(mark.id)}
                    className="type-body text-left text-foreground hover:underline"
                  >
                    {mark.quote}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {doc?.annotations.length ? (
            <p className="type-caption mt-6 flex items-center gap-1.5 text-faint-foreground">
              <Highlighter className="h-3.5 w-3.5" /> Click a mark to jump to it.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="related" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <h2 className="type-label mb-2.5">More like this</h2>
          <p className="type-caption">
            Related reading appears here once the agent has connected this document to others in
            the library. Ask it to compare two things and the edge it records is what shows up.
          </p>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
