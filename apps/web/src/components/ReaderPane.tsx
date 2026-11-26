import { useEffect, useLayoutEffect, useRef } from "react";
import {
  Archive,
  ArrowSquareOut,
  CornersOut,
  DotsThree,
  Sparkle,
} from "@phosphor-icons/react";
import type { Annotation, DocumentDetail } from "@/lib/api";
import { applyHighlights } from "@/lib/highlights";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HUES } from "@/lib/highlight-palette";
import { Markdown } from "./Markdown";

export interface NewHighlight {
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
  hue: number;
}

/** The reading surface. Narrow measure, the site's paper, a highlight rail. */
export function ReaderPane({
  doc,
  onHighlight,
  onToggleAsk,
  askOpen,
}: {
  doc: DocumentDetail | null;
  onHighlight: (input: NewHighlight) => void;
  onToggleAsk: () => void;
  askOpen: boolean;
}) {
  const articleRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (articleRef.current && doc) applyHighlights(articleRef.current, doc.annotations);
  }, [doc?.id, doc?.annotations, doc?.markdown]);

  // Repaint once fonts land, so the paint matches what the reader sees.
  useEffect(() => {
    const article = articleRef.current;
    if (!article || !doc) return;
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) applyHighlights(article, doc.annotations);
    });
    return () => {
      cancelled = true;
    };
  }, [doc?.id, doc?.annotations, doc?.markdown]);

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const quote = selection.toString().trim();
    if (quote.length < 3) return;
    const range = selection.getRangeAt(0);
    const article = articleRef.current;
    if (!article?.contains(range.commonAncestorContainer)) return;

    const text = article.textContent ?? "";
    const index = text.indexOf(quote);
    let occurrence = 0;
    for (let p = text.indexOf(quote); p !== -1 && p < index; p = text.indexOf(quote, p + 1)) {
      occurrence++;
    }
    onHighlight({
      quote,
      prefix: index >= 0 ? text.slice(Math.max(0, index - 40), index) : "",
      suffix: index >= 0 ? text.slice(index + quote.length, index + quote.length + 40) : "",
      occurrence,
      hue: 2,
    });
    selection.removeAllRanges();
  }

  if (!doc) {
    return (
      <section className="flex min-w-0 flex-1 items-center justify-center">
        <p className="type-caption">Pick something to read.</p>
      </section>
    );
  }

  const totalLines = Math.max(1, doc.markdown?.split("\n").length ?? 1);
  const meta = [doc.author, doc.site, doc.wordCount ? `${doc.wordCount.toLocaleString()} words` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-background">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 p-0.5 backdrop-blur">
        <Tip label="Ask Curio">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleAsk}
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
        <Tip label="Archive">
          <Button variant="ghost" size="icon-sm" aria-label="Archive">
            <Archive className="h-4 w-4" />
          </Button>
        </Tip>
        <Tip label="More">
          <Button variant="ghost" size="icon-sm" aria-label="More">
            <DotsThree className="h-4 w-4" />
          </Button>
        </Tip>
        <Tip label="Fullscreen">
          <Button variant="ghost" size="icon-sm" aria-label="Fullscreen">
            <CornersOut className="h-4 w-4" />
          </Button>
        </Tip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article
          ref={articleRef}
          onMouseUp={captureSelection}
          className="reader-prose prose prose-neutral mx-auto max-w-[680px] px-6 py-20 prose-p:leading-[1.75] prose-headings:tracking-[-0.01em] dark:prose-invert"
        >
          <h1 className="type-display mb-2">{doc.title || doc.externalId}</h1>
          {meta ? (
            <p className="type-caption mb-9 border-b border-border pb-6">{meta}</p>
          ) : (
            <div className="mb-9 border-b border-border" />
          )}
          {doc.markdown ? (
            <Markdown>{doc.markdown}</Markdown>
          ) : (
            <p>No stored text for this document.</p>
          )}
        </article>
      </div>

      <div className="absolute bottom-0 right-1 top-0 w-5" aria-label="Highlights">
        {doc.annotations.map((annotation, i) => (
          <RailTick key={annotation.id} annotation={annotation} totalLines={totalLines} index={i} />
        ))}
      </div>
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

function RailTick({
  annotation,
  totalLines,
  index,
}: {
  annotation: Annotation;
  totalLines: number;
  index: number;
}) {
  const top =
    annotation.startLine != null
      ? Math.min(96, Math.max(2, (annotation.startLine / totalLines) * 100))
      : 8 + index * 4;
  const color = HUES[annotation.hue]?.swatch ?? HUES[2]!.swatch;

  return (
    <button
      aria-label="Jump to highlight"
      title={annotation.quote.slice(0, 120)}
      onClick={() =>
        document
          .querySelector(`mark[data-annotation-id="${annotation.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      className="absolute right-2 h-[3px] w-3 rounded-full transition-[width] duration-100 hover:w-4"
      style={{ top: `${top}%`, backgroundColor: color }}
    />
  );
}
