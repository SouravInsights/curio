import type { CSSProperties, ReactNode } from "react";
import { cn } from "@curio/ui/lib/utils";

/**
 * Loading placeholders:
 *
 * - A skeleton block is a 250%-wide gradient whose position sweeps right to
 *   left. The block stays put; the light travels across it.
 * - A skeleton row pulses opacity, staggered down the list.
 * - A shimmering title uses the same sweep, painted through the text.
 */
export function SkeletonGroup({
  className,
  label,
  children,
}: {
  className?: string;
  /** Announced to screen readers. The blocks are hidden. */
  label: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function Skeleton({
  className,
  style,
  shimmer = true,
}: {
  className?: string;
  style?: CSSProperties;
  /** List rows pulse; article blocks sweep. Turn the sweep off for lists. */
  shimmer?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "rounded-[var(--radius-sm)]",
        shimmer ? "skeleton-shimmer" : "bg-muted",
        className,
      )}
    />
  );
}

/** The title of a link or article that is still being read. */
export function ShimmerText({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("shimmer-text", className)}>{children}</span>;
}
