import { useState } from "react";
import { PaperPlaneRight, X } from "@phosphor-icons/react";
import { ask } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The agent as a fourth pane. Answers stream from the same endpoint the app uses. */
export function AskPane({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = question.trim();
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

  return (
    <aside className="flex w-[400px] min-w-0 flex-col border-l border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="type-heading">Ask Curio</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!asked && !answer ? (
          <p className="type-caption">
            Ask about what you are reading, or across everything you have read. Answers cite the
            exact lines.
          </p>
        ) : null}
        {asked ? <p className="type-heading mb-2">{asked}</p> : null}
        {answer ? <p className="type-body whitespace-pre-wrap text-muted-foreground">{answer}</p> : null}
        {busy && !answer ? <p className="type-body text-muted-foreground">Searching the library…</p> : null}
        {error ? <p className="type-caption mt-2 text-destructive">{error}</p> : null}
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Textarea
          rows={1}
          value={question}
          placeholder="Ask a question"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          className="min-h-9 resize-none"
        />
        <Button type="submit" size="icon" disabled={busy || !question.trim()} aria-label="Send">
          <PaperPlaneRight className="h-4 w-4" />
        </Button>
      </form>
    </aside>
  );
}
