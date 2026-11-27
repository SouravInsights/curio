"use client";

import { Minus, Plus } from "@phosphor-icons/react";

export const TEXT_SCALES = [90, 100, 110, 120, 130];

/**
 * Text size as a stepper, not a row of five chips.
 *
 * Five chips is a ~225px control. On a phone it cannot share a line with its
 * label, so it either overflows or forces a wrap that looks like a bug; on a
 * page it reads as a toolbar. Two buttons and the current value are the whole
 * control, at every width. Settings and the reader's Appearance panel use this
 * one component, so the two cannot drift.
 */
export function TextSizeStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (scale: number) => void;
}) {
  const index = TEXT_SCALES.indexOf(value);
  const step = (delta: number) => {
    const next = TEXT_SCALES[Math.min(Math.max(index + delta, 0), TEXT_SCALES.length - 1)];
    if (next !== undefined) onChange(next);
  };

  return (
    <div className="flex items-center gap-0.5 rounded-[var(--radius-row)] border border-border bg-background p-0.5">
      <button
        type="button"
        aria-label="Smaller text"
        onClick={() => step(-1)}
        disabled={index <= 0}
        className="flex size-6 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
      >
        <Minus className="size-3" />
      </button>
      <span className="w-10 text-center text-[12.5px] font-medium tabular-nums text-foreground">
        {value}%
      </span>
      <button
        type="button"
        aria-label="Larger text"
        onClick={() => step(1)}
        disabled={index >= TEXT_SCALES.length - 1}
        className="flex size-6 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
