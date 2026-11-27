"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@curio/ui/lib/utils";

/**
 * The tooltip, from shadcn, on the app's tokens.
 *
 * A tooltip **inverts**: `bg-foreground text-background`, so it is a dark chip
 * in light mode and a light one in dark mode. That contrast is the point — it
 * reads as a transient label floating over the app, not as another panel in the
 * surface ladder. It is also what the shadcn `Kbd` expects: its
 * `[[data-slot=tooltip-content]_&]:text-background` only makes the shortcut
 * legible when the tooltip is inverted. Ours was not, so the key rendered
 * dark-on-dark and disappeared.
 */
const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 0, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      className={cn(
        "z-[var(--z-drop)] w-fit origin-[var(--radix-tooltip-content-transform-origin)] rounded-[var(--radius-row)] bg-foreground px-2.5 py-1.5 text-[var(--text-sm)] text-background text-balance shadow-[var(--shadow-card)]",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="z-[var(--z-drop)] size-2.5 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-[1px] bg-foreground fill-foreground" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
