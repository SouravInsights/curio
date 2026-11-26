import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/ui/tooltip";
import { isDark, toggleTheme } from "@/lib/theme";

/**
 * Light/dark, applied as the `.dark` class on `<html>` — the same switch the
 * design system's tokens use. The initial value is set before paint in
 * `app/layout.tsx`; this only reads it and flips it.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(isDark());
  }, []);

  function toggle() {
    toggleTheme();
    setDark(isDark());
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={dark ? "Switch to light" : "Switch to dark"}
          onClick={toggle}
          className="h-9 w-9 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{dark ? "Light" : "Dark"}</TooltipContent>
    </Tooltip>
  );
}
