/**
 * The reader toolbar's button, defined once.
 *
 * It was defined twice and drifted: the Appearance trigger was 32px and
 * `rounded-lg` while the toolbar buttons were 28px and `rounded-[--radius-control]`.
 * One row of controls with two sizes is what made the toolbar read as uneven.
 *
 * Radius is `--radius-md` (6px) on purpose: the toolbar's container is
 * `--radius-card` (10px) with `p-1` (4px), and a nested corner only sits clean
 * when the inner radius is the outer minus the padding. 10 − 4 = 6.
 */
export const TOOLBAR_BUTTON =
  "rounded-[var(--radius-md)] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground";

/** A toggle that is on: star, read, ask, focus. */
export const TOOLBAR_ACTIVE = "bg-foreground/[0.08] text-foreground";
