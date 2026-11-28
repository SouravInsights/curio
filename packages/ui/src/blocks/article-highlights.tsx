"use client";

import { useRef, useState, type ReactNode } from "react";
import { Highlight, type HighlightMark } from "@curio/ui/components/highlight/highlight";
import { HighlightRail, type HighlightRailItem } from "@curio/ui/components/highlight/highlight-rail";
import { ShareQuoteDialog } from "@curio/ui/quote/dialog";

export interface ArticleHighlightsProps {
  title: string;
  source: string;
  children: ReactNode;
}

/** Article body + palette + rail + share dialog, wired with local marks. */
export function ArticleHighlights({ title, source, children }: ArticleHighlightsProps) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<HighlightMark[]>([]);
  const [ticks, setTicks] = useState<HighlightRailItem[]>([]);
  const [share, setShare] = useState<{ quote: string; context: string } | null>(null);
  return (
    <>
      <div ref={articleRef}>{children}</div>
      <Highlight
        containerRef={articleRef}
        editable
        marks={marks}
        onMarksChange={setMarks}
        onShareQuote={setShare}
        onTicks={setTicks}
      />
      <HighlightRail
        ticks={ticks}
        onJump={(id) => {
          const mark = document.querySelector<HTMLElement>(`[data-hl="${id}"]`);
          mark?.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
      />
      <ShareQuoteDialog
        open={share !== null}
        onOpenChange={(open) => {
          if (!open) setShare(null);
        }}
        quote={share?.quote ?? ""}
        context={share?.context ?? ""}
        title={title}
        source={source}
      />
    </>
  );
}
