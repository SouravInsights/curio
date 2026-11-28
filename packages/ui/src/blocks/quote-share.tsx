"use client";

import { useState } from "react";
import { Button } from "@curio/ui/components/ui/button";
import { ShareQuoteDialog } from "@curio/ui/quote/dialog";

export interface QuoteShareProps {
  quote: string;
  context?: string;
  title: string;
  source: string;
}

/** A single share button over the quote studio. */
export function QuoteShare({ quote, context = "", title, source }: QuoteShareProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Share quote
      </Button>
      <ShareQuoteDialog
        open={open}
        onOpenChange={setOpen}
        quote={quote}
        context={context}
        title={title}
        source={source}
      />
    </>
  );
}
