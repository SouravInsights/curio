"use client";

import { cn } from "@curio/ui/lib/utils";

/**
 * A row of mutually exclusive choices — the app's segmented control.
 *
 * One implementation, so the reader's Appearance panel and Settings cannot
 * disagree on radius, height or the selected chip. Radix has no segmented
 * primitive; this is the radiogroup role done once, on the app's tokens.
 */
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex items-center gap-0.5 rounded-[var(--radius-row)] border border-border bg-background p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[var(--radius-control)] px-2.5 py-1 text-[12.5px] font-medium tabular-nums transition-colors",
            value === option.value
              ? "bg-foreground/[0.08] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
