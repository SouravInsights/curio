import {
  BookmarkSimple,
  Books,
  GearSix,
  Highlighter,
  MagnifyingGlass,
  Question,
  Rss,
  Tag,
  Tray,
  User,
} from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/tooltip";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@curio/ui/lib/utils";

const ITEMS = [
  { id: "search", label: "Search", Icon: MagnifyingGlass },
  { id: "library", label: "Library", Icon: Books },
  { id: "inbox", label: "Inbox", Icon: Tray },
  { id: "saved", label: "Saved", Icon: BookmarkSimple },
  { id: "highlights", label: "Highlights", Icon: Highlighter },
  { id: "feeds", label: "Feeds", Icon: Rss },
  { id: "tags", label: "Tags", Icon: Tag },
] as const;

const BOTTOM = [
  { id: "settings", label: "Settings", Icon: GearSix },
  { id: "help", label: "Help", Icon: Question },
  { id: "account", label: "Account", Icon: User },
] as const;

/** The global rail. Destinations are Curio's; the frame is the site's. */
export function NavRail({ view, onView }: { view: string; onView: (view: string) => void }) {
  return (
    <nav
      aria-label="Primary"
      className="flex flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar-background py-3"
    >
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-foreground text-sm font-bold text-background">
          C
        </div>

        {ITEMS.map(({ id, label, Icon }) => (
          <RailButton key={id} id={id} label={label} active={view === id} onClick={() => onView(id)}>
            <Icon className="h-[18px] w-[18px]" weight={view === id ? "fill" : "regular"} />
          </RailButton>
        ))}

        <div className="flex-1" />

        <ThemeToggle />

        {BOTTOM.map(({ id, label, Icon }) => (
          <RailButton key={id} id={id} label={label} active={false} onClick={() => undefined}>
            <Icon className="h-[18px] w-[18px]" />
          </RailButton>
        ))}
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
