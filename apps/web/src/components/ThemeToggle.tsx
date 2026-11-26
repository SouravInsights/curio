import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/tooltip";

const KEY = "curio-theme";

/**
 * Light/dark, applied as the `.dark` class on `<html>` — the same switch the
 * design system's tokens use. The initial value is set before paint in
 * `app/layout.tsx`; this only reads it and flips it.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // private mode: the class still applies for this visit
    }
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
