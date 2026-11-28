"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@curio/ui/lib/utils";

/**
 * A bottom sheet that behaves like the platform's.
 *
 * `vaul` owns the physics: the grabber, the drag, the snap points and the flick
 * down to dismiss. The surface is the app's tokens. Radix's dialog, which the
 * other sheets use, slides in and stays put; a panel that fills most of a phone
 * and cannot be dragged is the thing that reads as a website.
 */
const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-[var(--z-modal)] bg-black/60", className)}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex flex-col rounded-t-[var(--radius-panel)] bg-sidebar shadow-sheet outline-none",
        className,
      )}
      {...props}
    >
      {/* The grabber. Its whole job is to say "drag me", so it is the one
          element on the sheet that is pure affordance. */}
      <div
        aria-hidden="true"
        className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-foreground/15"
      />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerTitle = DrawerPrimitive.Title;
const DrawerDescription = DrawerPrimitive.Description;

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerClose,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
};
