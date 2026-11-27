/**
 * The reader toolbar's button.
 *
 * Radius is `--radius-md` (6px): the toolbar's container is `--radius-card`
 * (10px) with `p-1` (4px), and a nested corner sits clean when the inner radius
 * is the outer minus the padding.
 */
export const TOOLBAR_BUTTON =
  "rounded-[var(--radius-md)] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground";

/** A toggle that is on: star, read, ask, focus. */
export const TOOLBAR_ACTIVE = "bg-foreground/[0.08] text-foreground";
