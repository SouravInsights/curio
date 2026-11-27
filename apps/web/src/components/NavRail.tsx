import {
  Books,
  GearSix,
  Highlighter,
  MagnifyingGlass,
  Question,
  Tag,
} from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/tooltip";
import { ThemeToggle } from "./ThemeToggle";
import { Curio } from "@curio/ui/components/curio/mascot";
import { cn } from "@curio/ui/lib/utils";

/**
 * The rail holds only destinations that exist.
 *
 * It used to advertise Inbox, Saved, Feeds and Account, all of which rendered
 * the library list under a different title (or nothing at all). A destination
 * that is a dead end is worse than no destination: it teaches the reader that
 * the rail lies. These four are the surfaces the app actually has — the library
 * and its two ways in (search, browse), and the marks you left.
 */
const ITEMS = [
  { id: "search", label: "Search", Icon: MagnifyingGlass },
  { id: "library", label: "Library", Icon: Books },
  { id: "highlights", label: "Highlights", Icon: Highlighter },
  { id: "topics", label: "Topics", Icon: Tag },
] as const;

/** The global rail. Destinations are Curio's; the frame is the app's. */
export function NavRail({ view, onView }: { view: string; onView: (view: string) => void }) {
  return (
    <nav
      aria-label="Primary"
      className="relative z-20 flex w-16 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3"
    >
      <div className="mb-3 text-green-600 dark:text-green-500" title="Curio">
        <Curio size={30} still />
      </div>

      {ITEMS.map(({ id, label, Icon }) => (
        <RailButton key={id} id={id} label={label} active={view === id} onClick={() => onView(id)}>
          <Icon className="h-[18px] w-[18px]" weight={view === id ? "fill" : "regular"} />
        </RailButton>
      ))}

      <div className="flex-1" />

      <ThemeToggle />

      <RailButton
        id="settings"
        label="Settings"
        active={view === "settings"}
        onClick={() => onView("settings")}
      >
        <GearSix className="h-[18px] w-[18px]" weight={view === "settings" ? "fill" : "regular"} />
      </RailButton>

      {/* Help is a real page, so it is a real link — not a button that does nothing. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Help and API docs"
            className="h-9 w-9 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <a href="/docs">
              <Question className="h-[18px] w-[18px]" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Help & API</TooltipContent>
      </Tooltip>
    </nav>
  );
}

function RailButton({
  id,
  label,
  active,
  onClick,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-current={active}
          onClick={onClick}
          className={cn(
            "h-9 w-9 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            active && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" data-id={id}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
