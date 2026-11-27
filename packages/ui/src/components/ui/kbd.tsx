import { cn } from "@curio/ui/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-border bg-foreground/[0.04] px-1.5 font-sans text-xs font-medium text-muted-foreground",
        "[&_svg:not([class*='size-'])]:size-3",
        // In a tooltip the key is a 16px chip with a 1px inset ring at quarter
        // strength, 11px medium, in the label's own colour at 75% — bright
        // enough to read at a glance on a raised surface.
        "[[data-slot=tooltip-content]_&]:h-4 [[data-slot=tooltip-content]_&]:min-w-4 [[data-slot=tooltip-content]_&]:rounded-[4px] [[data-slot=tooltip-content]_&]:border-0 [[data-slot=tooltip-content]_&]:bg-transparent [[data-slot=tooltip-content]_&]:px-[3px] [[data-slot=tooltip-content]_&]:text-[11px] [[data-slot=tooltip-content]_&]:leading-4 [[data-slot=tooltip-content]_&]:text-popover-foreground/75 [[data-slot=tooltip-content]_&]:ring-1 [[data-slot=tooltip-content]_&]:ring-inset [[data-slot=tooltip-content]_&]:ring-popover-foreground/25",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
