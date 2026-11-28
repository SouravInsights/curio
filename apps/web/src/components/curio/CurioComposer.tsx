"use client";

import { ArrowUp, Square } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * The composer for the full page.
 *
 * A textarea rather than the rail's single-line box, because this is where a
 * real conversation happens: it grows to five lines and then scrolls, Enter
 * sends, Shift+Enter breaks the line.
 */
export function CurioComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  leading,
  placeholder = "Ask about anything you have saved…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** Session actions, at the head of the box instead of floating loose above. */
  leading?: ReactNode;
  onStop?: () => void;
  placeholder?: string;
  busy: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to the cap, then scroll. Height resets to auto
  // first, or the box could never shrink back after a line was deleted.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const send = () => {
    if (busy || !value.trim()) return;
    onSubmit(value);
    // Keep the keyboard up: a chat is a run of questions, and tapping the box
    // again between each one is what makes a phone chat feel slow.
    textareaRef.current?.focus();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="flex items-end gap-2 rounded-[var(--radius-card)] border border-border bg-card p-2 transition-colors focus-within:border-input focus-within:ring-2 focus-within:ring-ring/30"
    >
      {leading}
      {/* `min-h-9` matches the send button's height, so an empty box is exactly
          as tall as the button and both centre on the same line. */}
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        maxLength={2000}
        {...({ enterkeyhint: "send" } as unknown as Record<string, string>)}
        spellCheck={false}
        aria-label="Ask Curio"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-base leading-relaxed outline-none placeholder:text-faint-foreground"
      />
      {busy && onStop ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-label="Ask"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
