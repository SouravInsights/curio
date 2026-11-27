"use client";

import { useRef } from "react";
import { useState } from "react";
import {
  ArrowLeft,
  Archive,
  ArrowSquareOut,
  ArrowUUpLeft,
  CheckCircle,
  CornersOut,
  Sparkle,
  Star,
} from "@phosphor-icons/react";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { cn } from "@curio/ui/lib/utils";
import { TOOLBAR_ACTIVE, TOOLBAR_BUTTON } from "@/lib/toolbar";
import { keyFor } from "@/lib/shortcuts";
import type { DocumentDetail } from "@/lib/api";
import { Highlight, type CreatePayload } from "@curio/ui/components/highlight/highlight";
import { Button } from "@curio/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/tooltip";
import { Markdown } from "./Markdown";
import {
  ReaderAppearance,
  appearanceStyle,
  type Appearance,
} from "./ReaderAppearance";

/** One button in the reader toolbar. `active` paints the on state. */
function toolbarButton(active = false) {
  return cn(TOOLBAR_BUTTON, active && TOOLBAR_ACTIVE);
}

/**
 * The reading surface.
 *
 * The highlight system is the `Highlight` component, mounted as a sibling of
 * the element it scans and never inside it, so the engine's own live region
 * does not end up in the paragraph list.
 */
export function ReaderPane({
  doc,
  onCreate,
  onRecolor,
  onDelete,
  onToggleAsk,
  onToggleFocus,
  onShareQuote,
  onArchive,
  onUnarchive,
  onMarkRead,
  onToggleFavorite,
  appearance,
  onAppearance,
  onBack,
  askOpen,
  focus,
}: {
  doc: DocumentDetail | null;
  onCreate: (payload: CreatePayload) => Promise<number | null>;
  onRecolor: (id: number, hue: number) => void;
  onDelete: (id: number) => void;
  onToggleAsk: () => void;
  onToggleFocus: () => void;
  onShareQuote: (payload: { quote: string; context: string }) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onMarkRead: () => void;
  onToggleFavorite: () => void;
  appearance: Appearance;
  onAppearance: (value: Appearance) => void;
  /** Mobile only: return to the list. */
  onBack?: () => void;
  askOpen: boolean;
  /** The list pane hidden for a full-width read; the Focus button shows it. */
  focus: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Any popper open in the toolbar. Tooltips stand down while one is, so a
  // tooltip never renders beneath an open menu.
  const [popperOpen, setPopperOpen] = useState(false);

  if (!doc) {
    return (
      <section className="flex h-full min-w-0 items-center justify-center">
        <p className="type-caption">Pick something to read.</p>
      </section>
    );
  }

  const meta = [doc.author, doc.site, doc.wordCount ? `${doc.wordCount.toLocaleString()} words` : null]
    .filter(Boolean)
    .join(" · ");

  // The markdown usually opens with its own `# Title`, which we render from
  // metadata. Drop the duplicate rather than printing the title twice.
  const markdown = (doc.markdown ?? "").replace(/^#\s+(.+?)\s*\n+/, (match, text: string) =>
    text.trim().toLowerCase() === (doc.title ?? "").trim().toLowerCase() ? "" : match,
  );

  return (
    <section className="relative flex h-full min-w-0 flex-col bg-background">
      {/* One row, one button size, one radius. The container is --radius-card
          (10px) with p-1 (4px), so the buttons are --radius-md (6px): a nested
          corner only sits clean when the inner radius is the outer minus the
          padding. Dividers group document actions, view controls, and the one
          destructive action. */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-[var(--radius-card)] border border-border/60 bg-background/85 p-1 backdrop-blur">
        {onBack
          ? tip(
              "Back to list",
              null,
              <Button
                variant="ghost"
                size="icon"
                aria-label="Back to list"
                onClick={onBack}
                className={toolbarButton()}
              >
                <ArrowLeft />
              </Button>,
              popperOpen,
            )
          : null}

        {tip(
          "Ask Curio",
          keyFor("ask"),
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleAsk}
            aria-label="Ask Curio"
            aria-pressed={askOpen}
            className={toolbarButton(askOpen)}
          >
            <Sparkle weight={askOpen ? "fill" : "regular"} />
          </Button>,
          popperOpen,
        )}

        {doc.url
          ? tip(
              "Open original",
              keyFor("open"),
              <Button variant="ghost" size="icon" asChild className={toolbarButton()}>
                <a href={doc.url} target="_blank" rel="noreferrer" aria-label="Open original">
                  <ArrowSquareOut />
                </a>
              </Button>,
              popperOpen,
            )
          : null}

        {tip(
          doc.favorite ? "Unstar" : "Star",
          keyFor("star"),
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            aria-label={doc.favorite ? "Unstar" : "Star"}
            aria-pressed={doc.favorite}
            className={cn(toolbarButton(doc.favorite), doc.favorite && "text-[var(--favorite)]")}
          >
            <Star weight={doc.favorite ? "fill" : "regular"} />
          </Button>,
          popperOpen,
        )}

        {tip(
          doc.readState === "read" ? "Mark as unread" : "Mark as read",
          keyFor("read"),
          <Button
            variant="ghost"
            size="icon"
            onClick={onMarkRead}
            aria-label={doc.readState === "read" ? "Mark as unread" : "Mark as read"}
            aria-pressed={doc.readState === "read"}
            className={toolbarButton(doc.readState === "read")}
          >
            <CheckCircle weight={doc.readState === "read" ? "fill" : "regular"} />
          </Button>,
          popperOpen,
        )}

        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />

        {/* Content, not an action: the appearance controls are a popover. */}
        <ReaderAppearance
          value={appearance}
          onChange={onAppearance}
          onOpenChange={setPopperOpen}
        />

        {tip(
          "Focus mode",
          keyFor("focus"),
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFocus}
            aria-label="Focus mode"
            aria-pressed={focus}
            className={toolbarButton(focus)}
          >
            <CornersOut />
          </Button>,
          popperOpen,
        )}

        {/* The one destructive action. It sits behind a divider and turns red
            on hover, but stays in the toolbar: it is used often enough to be a
            first-class action, and it is reversible. A menu for one command is
            worse than a separated button. */}
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />

        {doc.readState === "archived"
          ? tip(
              "Unarchive",
              keyFor("archive"),
              <Button
                variant="ghost"
                size="icon"
                onClick={onUnarchive}
                aria-label="Unarchive"
                className={toolbarButton()}
              >
                <ArrowUUpLeft />
              </Button>,
              popperOpen,
            )
          : tip(
              "Archive",
              keyFor("archive"),
              <Button
                variant="ghost"
                size="icon"
                onClick={onArchive}
                aria-label="Archive"
                className={cn(toolbarButton(), "hover:bg-destructive/10 hover:text-destructive")}
              >
                <Archive />
              </Button>,
              popperOpen,
            )}
      </div>

      <div className="scroll-contain min-h-0 flex-1 overflow-y-auto">
        <article
          className="reader-prose prose prose-neutral mx-auto px-6 py-20 dark:prose-invert"
          style={{
            maxWidth: appearance.width === "narrow" ? "var(--measure-narrow)" : "var(--measure)",
            ...appearanceStyle(appearance),
          }}
        >
          <h1 className="type-display mb-2">{doc.title || doc.externalId}</h1>
          {meta ? <p className="type-caption mb-9 border-b border-border pb-6">{meta}</p> : null}
          <div ref={containerRef}>
            {markdown ? <Markdown>{markdown}</Markdown> : <p>No stored text for this document.</p>}
          </div>
        </article>
      </div>

      <Highlight
        containerRef={containerRef}
        editable
        initialMarks={doc.annotations.map((a) => ({
          id: a.id,
          quote: a.quote,
          occurrence: a.occurrence,
          hue: a.hue,
        }))}
        onCreate={onCreate}
        onRecolor={onRecolor}
        onDelete={onDelete}
        onShareQuote={onShareQuote}
      />
    </section>
  );
}

/**
 * A tooltip for a toolbar control.
 *
 * Suppressed while a popover or menu is open. Two reasons, and the second is the
 * one that matters: a tooltip rendering *under* an open menu reads as a bug, and
 * the offset here is the same as the popper's so the two never look like
 * different components.
 */
function tip(label: string, shortcut: string | null, node: React.ReactNode, suppressed: boolean) {
  return suppressed ? node : <Tip label={label} shortcut={shortcut}>{node}</Tip>;
}

function Tip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut: string | null;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
