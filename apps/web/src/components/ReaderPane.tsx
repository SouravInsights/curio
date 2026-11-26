import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowSquareOut,
  CornersOut,
  DotsThree,
  Sparkle,
} from "@phosphor-icons/react";
import type { Annotation, DocumentDetail } from "@/lib/api";
import { applyHighlights } from "@/lib/highlights";
import { Button } from "@curio/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/tooltip";
import { HUES, paint } from "@/lib/highlight-palette";
import { Markdown } from "./Markdown";

export interface NewHighlight {
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
  hue: number;
}

interface PendingSelection {
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
  x: number;
  y: number;
}

/** The reading surface: narrow measure, the site's paper, a highlight rail. */
export function ReaderPane({
  doc,
  onHighlight,
  onToggleAsk,
  onToggleFocus,
  askOpen,
}: {
  doc: DocumentDetail | null;
  onHighlight: (input: NewHighlight) => void;
  onToggleAsk: () => void;
  onToggleFocus: () => void;
  askOpen: boolean;
}) {
  const paneRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<PendingSelection | null>(null);

  useLayoutEffect(() => {
    if (articleRef.current && doc) applyHighlights(articleRef.current, doc.annotations);
  }, [doc?.id, doc?.annotations, doc?.markdown]);

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

  // A selection raises the palette; nothing is saved until a hue is chosen.
  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const quote = sel.toString().trim();
    const article = articleRef.current;
    const pane = paneRef.current;
    if (quote.length < 3 || !article || !pane) return;
    const range = sel.getRangeAt(0);
    if (!article.contains(range.commonAncestorContainer)) return;

    const text = article.textContent ?? "";
    const index = text.indexOf(quote);
    let occurrence = 0;
    for (let p = text.indexOf(quote); p !== -1 && p < index; p = text.indexOf(quote, p + 1)) occurrence++;

    const rect = range.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    setSelection({
      quote,
      prefix: index >= 0 ? text.slice(Math.max(0, index - 40), index) : "",
      suffix: index >= 0 ? text.slice(index + quote.length, index + quote.length + 40) : "",
      occurrence,
      x: rect.left - paneRect.left + rect.width / 2,
      y: rect.top - paneRect.top,
    });
  }

  function choose(hue: number) {
    if (!selection) return;
    onHighlight({
      quote: selection.quote,
      prefix: selection.prefix,
      suffix: selection.suffix,
      occurrence: selection.occurrence,
      hue,
    });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
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

  // The markdown usually opens with its own `# Title`, which we render from
  // metadata. Drop the duplicate rather than printing the title twice.
  const markdown = (doc.markdown ?? "").replace(/^#\s+(.+?)\s*\n+/, (match, text: string) =>
    text.trim().toLowerCase() === (doc.title ?? "").trim().toLowerCase() ? "" : match,
  );

  return (
    <section ref={paneRef} className="relative flex min-w-0 flex-1 flex-col bg-background">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 p-0.5 backdrop-blur">
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
        <Tip label="Focus mode">
          <Button variant="ghost" size="icon-sm" aria-label="Focus mode" onClick={onToggleFocus}>
            <CornersOut className="h-4 w-4" />
          </Button>
        </Tip>
      </div>

      {selection ? (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-full border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{ left: selection.x, top: selection.y }}
        >
          <div className="flex items-center gap-1">
            {HUES.map((hue, index) => (
              <button
                key={hue.name}
                aria-label={hue.name}
                title={hue.name}
                onClick={() => choose(index)}
                className="h-5 w-5 rounded-full ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ backgroundColor: hue.swatch }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article
          ref={articleRef}
          onMouseUp={captureSelection}
          className="reader-prose prose prose-neutral mx-auto max-w-[680px] px-6 py-20 prose-p:leading-[1.75] prose-headings:tracking-[-0.01em] dark:prose-invert"
        >
          <h1 className="type-display mb-2">{doc.title || doc.externalId}</h1>
          {meta ? <p className="type-caption mb-9 border-b border-border pb-6">{meta}</p> : null}
          {markdown ? <Markdown>{markdown}</Markdown> : <p>No stored text for this document.</p>}
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
  const { wash } = paint(annotation.hue, true);

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
      style={{ top: `${top}%`, backgroundColor: HUES[annotation.hue]?.swatch, opacity: 0.85 }}
      data-wash={wash}
    />
  );
}
