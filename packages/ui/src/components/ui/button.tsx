import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@curio/ui/lib/utils";

/**
 * The button.
 *
 * A control is small: the label is `--text-ui` (13px) at the default size and a
 * step under at the compact one, the icon is 14–16px and sits 6px from the
 * words. Buttons are chrome, and chrome should not shout — the reading surface
 * is the only place the type is large.
 *
 * `outline` is not a border with nothing inside it: it fills a few percent of
 * ink, so on the sidebar (or the page, or a card) it reads as a raised control
 * rather than a wireframe. `ghost` is the borderless version, for a row that
 * already has its own shape.
 *
 * Heights come from the token ladder: `--h-control` (32px) default, 28px
 * compact, 36px large. Focus is a soft ring — the same one the app's newer
 * controls use, so a keyboard user sees one focus treatment everywhere.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-foreground/[0.05] text-foreground hover:bg-foreground/[0.09]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-foreground/[0.06] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--h-control)] px-3 text-[13px] [&_svg]:size-4",
        sm: "h-7 px-2.5 text-[12.5px] [&_svg]:size-3.5",
        lg: "h-9 gap-2 rounded-[var(--radius-row)] px-4 text-[13.5px] [&_svg]:size-4",
        icon: "h-[var(--h-control)] w-[var(--h-control)] [&_svg]:size-4",
        "icon-sm": "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
