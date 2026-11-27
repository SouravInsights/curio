

import { Minus, Plus, TextAa } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@curio/ui/components/ui/popover";
import { Button } from "@curio/ui/components/ui/button";
import { SegmentedControl } from "@curio/ui/components/ui/segmented-control";
import { TOOLBAR_BUTTON } from "@/lib/toolbar";

/**
 * The reader's Appearance panel: the three things a reader actually changes
 * about the page they are reading, and nothing else.
 *
 * It lives in the reader's own header rather than in a settings page, because
 * the thing being changed is on screen — you move the size, the line length or
 * the face and watch the article answer. The choices stick across articles, so
 * they are made once.
 */

export interface Appearance {
  font: "sans" | "serif";
  /** percentage of the base text size */
  scale: number;
  width: "narrow" | "wide";
}

export const APPEARANCE_DEFAULT: Appearance = {
  font: "serif",
  scale: 100,
  width: "wide",
};

const SCALES = [90, 100, 110, 120, 130];

/** Inter, loaded by `next/font` on the body as `--font-inter`. */
const SANS = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";

/**
 * The face and size the article is set in, as inline style.
 *
 * Both faces are named here on purpose. Leaving the sans case unset let it fall
 * through to `.reader-prose`'s `--font-reading` (Charter/Georgia), so "Sans"
 * and "Serif" rendered identically. The size is the face's own base times the
 * scale, not a bare percentage — a percentage resolves against the *parent*,
 * which silently overrode the article's base size.
 */
export function appearanceStyle(value: Appearance): React.CSSProperties {
  const serif = value.font === "serif";
  return {
    fontFamily: serif ? "var(--font-reading)" : SANS,
    fontSize: `calc(var(${serif ? "--text-reading-serif" : "--text-reading"}) * ${value.scale / 100})`,
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function ReaderAppearance({
  value,
  onChange,
  onOpenChange,
}: {
  value: Appearance;
  onChange: (value: Appearance) => void;
  /** Lets the toolbar stand its tooltips down while this is open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const index = SCALES.indexOf(value.scale);
  const step = (delta: number) => {
    const next = SCALES[Math.min(Math.max(index + delta, 0), SCALES.length - 1)];
    if (next !== undefined) onChange({ ...value, scale: next });
  };

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Appearance"
          title="Appearance"
          className={TOOLBAR_BUTTON}
        >
          <TextAa />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <h2 className="mb-1.5 text-[13px] font-semibold text-foreground">Appearance</h2>

        <Row label="Font">
          <SegmentedControl<Appearance["font"]>
            label="Font"
            value={value.font}
            onChange={(font) => onChange({ ...value, font })}
            options={[
              { value: "sans", label: "Sans" },
              { value: "serif", label: "Serif" },
            ]}
          />
        </Row>

        <Row label="Text size">
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
              {value.scale}%
            </span>
            <button
              type="button"
              aria-label="Larger text"
              onClick={() => step(1)}
              disabled={index >= SCALES.length - 1}
              className="flex size-6 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </Row>

        <Row label="Width">
          <SegmentedControl<Appearance["width"]>
            label="Width"
            value={value.width}
            onChange={(width) => onChange({ ...value, width })}
            options={[
              { value: "narrow", label: "Narrow" },
              { value: "wide", label: "Wide" },
            ]}
          />
        </Row>
      </PopoverContent>
    </Popover>
  );
}
