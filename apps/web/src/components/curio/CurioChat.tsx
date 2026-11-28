"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, DotsThree, Plus } from "@phosphor-icons/react";
import { Curio } from "@curio/ui/components/curio/mascot";
import { Popover, PopoverContent, PopoverTrigger } from "@curio/ui/components/ui/popover";
import { ask, type AgentSource } from "@/lib/api";
import { useSuggestions, useThreadById } from "@/lib/queries";
import { CurioComposer } from "./CurioComposer";
import { CurioTranscript, transcriptAsMarkdown, type CurioTurn } from "./CurioConversation";
import { SuggestionRows } from "./SuggestionRows";

/**
 * The library-wide agent, as a panel inside the app.
 *
 * The rail's co-reader is the same agent beside one document; this is the agent
 * over everything. It fills the column it is given — the shell owns the frame,
 * the header and the destination, so this owns only the conversation.
 *
 * Empty, the composer sits centred and last, under the ways in; once there is an
 * answer to read, the transcript takes every remaining pixel and the composer
 * docks. Conversations are persisted per reader, so closing the app does not
 * lose the thread.
 */
export function CurioChat({
  threadId,
  onNew,
  onThreadCreated,
  onOpenSource,
}: {
  threadId: number | null;
  /** Start over: clear the conversation. */
  onNew: () => void;
  /** The first turn named the thread — remember it. */
  onThreadCreated: (id: number) => void;
  /** Open a cited span in the reader. */
  onOpenSource: (source: AgentSource) => void;
}) {
  const suggestions = useSuggestions();

  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<CurioTurn[]>([]);
  const [streaming, setStreaming] = useState("");
  const [sources, setSources] = useState<AgentSource[]>([]);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const seededFor = useRef<number | null>(null);

  const thread = useThreadById(threadId);

  // A new conversation starts blank. An existing one is seeded from its stored
  // turns once — live turns are appended locally, so the fetch cannot duplicate
  // them.
  useEffect(() => {
    if (threadId == null) {
      seededFor.current = null;
      setTurns([]);
      return;
    }
    if (thread.data === undefined || seededFor.current === threadId) return;
    seededFor.current = threadId;
    setTurns(
      thread.data.messages
        .map((message) => ({
          role: message.role,
          text: (message.parts as { type?: string; text?: string }[])
            .filter((part) => part.type === "text" && part.text)
            .map((part) => part.text)
            .join(""),
        }))
        .filter((turn) => turn.text),
    );
  }, [threadId, thread.data]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    setStreaming("");
    setSources([]);
    setInput("");
    setTurns((prev) => [...prev, { role: "user", text: q }]);

    const abort = new AbortController();
    controller.current = abort;
    let answer = "";
    let found: AgentSource[] = [];

    try {
      const id = await ask(threadId ? { threadId } : {}, q, {
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
      if (id && id !== threadId) {
        seededFor.current = id;
        onThreadCreated(id);
      }
      setTurns((prev) => [...prev, { role: "assistant", text: answer, sources: found }]);
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

  const started = turns.length > 0 || busy;
  const chips = suggestions.data ?? [];

  const actions = (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Conversation actions"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <DotsThree className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} collisionPadding={12} className="w-56 p-1">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-[var(--radius-row)] px-3 py-2 text-left type-caption text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          New conversation
        </button>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(transcriptAsMarkdown(turns)).catch(() => undefined)
          }
          className="flex w-full items-center gap-2 rounded-[var(--radius-row)] px-3 py-2 text-left type-caption text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy transcript
        </button>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4">
      {started ? (
        <>
          <div className="scroll-contain min-h-0 flex-1 overflow-y-auto py-6">
            <CurioTranscript
              turns={turns}
              streaming={streaming}
              liveSources={sources}
              phase={phase}
              error={error}
              busy={busy}
              onOpenSource={onOpenSource}
              onRetry={() => {
                const last = [...turns].reverse().find((turn) => turn.role === "user");
                if (last) void send(last.text);
              }}
            />
          </div>
          <div className="shrink-0 pb-3 pt-2">
            <CurioComposer
              leading={!busy ? actions : undefined}
              value={input}
              onChange={setInput}
              onSubmit={send}
              onStop={stop}
              busy={busy}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-8 overflow-y-auto px-1 py-6">
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            <Curio size={96} />
            <div className="flex flex-col gap-1">
              <p className="type-heading">Ask Curio</p>
              <p className="type-caption text-faint-foreground">
                Answers come from what you have read, with the lines they came from.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {chips.length ? (
              <SuggestionRows suggestions={chips} onPick={send} disabled={busy} />
            ) : null}
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Your other agents can read the same library — point an MCP client at it, or call the API.
            </p>
          </div>

          <div className="mt-2">
            <CurioComposer
              leading={!busy ? actions : undefined}
              value={input}
              onChange={setInput}
              onSubmit={send}
              onStop={stop}
              busy={busy}
            />
          </div>
        </div>
      )}
    </div>
  );
}
