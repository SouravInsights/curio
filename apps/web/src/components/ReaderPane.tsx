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
  DotsThree,
  Sparkle,
  Star,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@curio/ui/components/ui/dropdown-menu";
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
      <div className="absolute right-4 top-4 z-10 flex items-center gap-0.5 rounded-[var(--radius-row)] border border-border/60 bg-background/80 p-0.5 backdrop-blur">
        {onBack ? (
          <Button variant="ghost" size="icon-sm" aria-label="Back to list" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}

        {tip(
          "Ask Curio",
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleAsk}
            aria-label="Ask Curio"
            aria-current={askOpen}
            className={askOpen ? "bg-[var(--hover)] text-foreground" : ""}
          >
            <Sparkle className="h-4 w-4" weight={askOpen ? "fill" : "regular"} />
          </Button>,
          popperOpen,
        )}

        {doc.url
          ? tip(
              "Open original",
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={doc.url} target="_blank" rel="noreferrer" aria-label="Open original">
                  <ArrowSquareOut className="h-4 w-4" />
                </a>
              </Button>,
              popperOpen,
            )
          : null}

        {/* Content, not an action: the appearance controls are a popover. */}
        <ReaderAppearance
          value={appearance}
          onChange={onAppearance}
          onOpenChange={setPopperOpen}
        />

        {/* Actions are one menu. Archive is destructive, so it does not sit a
            mis-click away in the toolbar. */}
        <DropdownMenu onOpenChange={setPopperOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <DotsThree className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onToggleFavorite}>
              <Star weight={doc.favorite ? "fill" : "regular"} />
              {doc.favorite ? "Unstar" : "Star"}
              <DropdownMenuShortcut>F</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMarkRead}>
              <CheckCircle weight={doc.readState === "read" ? "fill" : "regular"} />
              {doc.readState === "read" ? "Mark as unread" : "Mark as read"}
              <DropdownMenuShortcut>M</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleFocus}>
              <CornersOut />
              Focus mode
              <DropdownMenuShortcut>⌘.</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {doc.readState === "archived" ? (
              <DropdownMenuItem onSelect={onUnarchive}>
                <ArrowUUpLeft />
                Unarchive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={onArchive}
                className="text-[var(--danger)] focus:text-[var(--danger)]"
              >
                <Archive />
                Archive
                <DropdownMenuShortcut>E</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
function tip(label: string, node: React.ReactNode, suppressed: boolean) {
  return suppressed ? node : <Tip label={label}>{node}</Tip>;
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
