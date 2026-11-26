"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@curio/ui/components/ui/dialog";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { SHORTCUTS } from "@/lib/shortcuts";

const GROUPS = ["General", "Document", "View"] as const;

/**
 * The whole keymap, on `?`. The tooltips show a key next to the action it
 * belongs to; this is where you find them before you know the action exists.
 * Both read from `lib/shortcuts`, so neither can invent a key.
 */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="type-heading">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="type-caption">
            Press a key while nothing is focused. Press ? any time to bring this back.
          </DialogDescription>
        </DialogHeader>

        <div className="scroll-contain max-h-[70vh] overflow-y-auto px-2 py-2">
          {GROUPS.map((group) => {
            const items = SHORTCUTS.filter((shortcut) => shortcut.group === group);
            if (!items.length) return null;
            return (
              <section key={group} className="px-3 py-2">
                <h3 className="type-label pb-1.5">{group}</h3>
                <ul className="flex flex-col">
                  {items.map((shortcut) => (
                    <li
                      key={shortcut.id}
                      className="flex min-h-9 items-center justify-between gap-4"
                    >
                      <span className="type-body text-muted-foreground">{shortcut.label}</span>
                      <Kbd>{shortcut.keys}</Kbd>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
