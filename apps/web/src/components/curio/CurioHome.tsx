"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Copy, DotsThree, Plus } from "@phosphor-icons/react";
import { Curio } from "@curio/ui/components/curio/mascot";
import { CurioWordmark } from "@curio/ui/components/curio/wordmark";
import { Popover, PopoverContent, PopoverTrigger } from "@curio/ui/components/ui/popover";
import { ask, type AgentSource } from "@/lib/api";
import { useMe, useSuggestions, useThreadById } from "@/lib/queries";
import { SignIn } from "../SignIn";
import { CurioComposer } from "./CurioComposer";
import { CurioTranscript, transcriptAsMarkdown, type CurioTurn } from "./CurioConversation";
import { SuggestionRows } from "./SuggestionRows";

const LAST_THREAD_KEY = "curio-last-thread";

/**
 * Curio's own page: the agent with the whole screen.
 *
 * The library-wide counterpart to the rail's co-reader. One column, the whole
 * viewport, and the composer going where the work is — centred and last in the
 * empty state, docked once there is an answer to read. Conversations are
 * persisted per reader, so closing the tab does not lose the thread.
 */
export function CurioHome() {
  const account = useMe();
  const user = account.data;
  const suggestions = useSuggestions(user != null);

  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<number | null>(null);
  const [turns, setTurns] = useState<CurioTurn[]>([]);
  const [streaming, setStreaming] = useState("");
  const [sources, setSources] = useState<AgentSource[]>([]);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const seededFor = useRef<number | null>(null);

  const thread = useThreadById(threadId);

  // Restore the last conversation once, so a reload lands where it left off.
  useEffect(() => {
    const stored = Number(localStorage.getItem(LAST_THREAD_KEY));
    if (Number.isInteger(stored) && stored > 0) setThreadId(stored);
  }, []);

  // Seed the transcript from the stored thread, once per conversation. Live
  // turns are appended locally, so the fetch cannot duplicate them.
  useEffect(() => {
    if (threadId == null || thread.data === undefined || seededFor.current === threadId) return;
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
        setThreadId(id);
        localStorage.setItem(LAST_THREAD_KEY, String(id));
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

  function newConversation() {
    setTurns([]);
    setThreadId(null);
    setStreaming("");
    setSources([]);
    setError("");
    localStorage.removeItem(LAST_THREAD_KEY);
  }

  // The session is the gate. Providers holds the page until identity resolves,
  // so here it is only "signed out" or "signed in".
  if (account.isError || user === undefined) return <div className="min-h-dvh bg-background" />;
  if (!user) return <SignIn onDone={() => window.location.reload()} />;

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
          onClick={newConversation}
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
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2 rounded-sm focus-visible:outline-none">
          <Curio size={22} still />
          <CurioWordmark size="sm" />
        </Link>
        <Link
          href="/"
          className="type-caption text-muted-foreground transition-colors hover:text-foreground"
        >
          Library
        </Link>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
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
                onRetry={() => {
                  const last = [...turns].reverse().find((turn) => turn.role === "user");
                  if (last) void send(last.text);
                }}
              />
            </div>
            <div className="shrink-0 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
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
                <p className="type-heading">Curio</p>
                <p className="type-caption text-faint-foreground">
                  Ask anything from what you have read, or tap a suggestion below.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {chips.length ? (
                <SuggestionRows suggestions={chips} onPick={send} disabled={busy} />
              ) : null}
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Use it from your own agent too: point{" "}
                <Link
                  href="/docs"
                  className="rounded-sm underline decoration-border underline-offset-4 transition-colors hover:text-green-700 dark:hover:text-green-500"
                >
                  an MCP client
                </Link>{" "}
                at the library, or call the API.
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
    </div>
  );
}
