"use client";

import { useRef } from "react";
import {
  ArrowLeft,
  Archive,
  ArrowSquareOut,
  CheckCircle,
  CornersOut,
  Sparkle,
  Star,
} from "@phosphor-icons/react";
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
  onMarkRead: () => void;
  onToggleFavorite: () => void;
  appearance: Appearance;
  onAppearance: (value: Appearance) => void;
  /** Mobile only: return to the list. */
  onBack?: () => void;
  askOpen: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

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
        <Tip label="Ask Curio">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleAsk}
            aria-label="Ask Curio"
            aria-current={askOpen}
            className={askOpen ? "bg-accent text-accent-foreground" : ""}
          >
            <Sparkle className="h-4 w-4" weight={askOpen ? "fill" : "regular"} />
          </Button>
        </Tip>
        {doc.url ? (
          <Tip label="Open original">
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={doc.url} target="_blank" rel="noreferrer" aria-label="Open original">
                <ArrowSquareOut className="h-4 w-4" />
              </a>
            </Button>
          </Tip>
        ) : null}
        <Tip label={doc.favorite ? "Unstar" : "Star"}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={doc.favorite ? "Unstar" : "Star"}
            onClick={onToggleFavorite}
          >
            <Star
              className={doc.favorite ? "h-4 w-4 text-[var(--favorite)]" : "h-4 w-4"}
              weight={doc.favorite ? "fill" : "regular"}
            />
          </Button>
        </Tip>
        <Tip label={doc.readState === "read" ? "Mark as unread" : "Mark as read"}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={doc.readState === "read" ? "Mark as unread" : "Mark as read"}
            onClick={onMarkRead}
          >
            <CheckCircle
              className="h-4 w-4"
              weight={doc.readState === "read" ? "fill" : "regular"}
            />
          </Button>
        </Tip>
        <Tip label="Archive">
          <Button variant="ghost" size="icon-sm" aria-label="Archive" onClick={onArchive}>
            <Archive className="h-4 w-4" />
          </Button>
        </Tip>
        <ReaderAppearance value={appearance} onChange={onAppearance} />
        <Tip label="Focus mode">
          <Button variant="ghost" size="icon-sm" aria-label="Focus mode" onClick={onToggleFocus}>
            <CornersOut className="h-4 w-4" />
          </Button>
        </Tip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
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

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
