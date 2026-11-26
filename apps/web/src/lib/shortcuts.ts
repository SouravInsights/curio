/**
 * Every keyboard shortcut, in one place.
 *
 * The handler in `Shell` dispatches from this list, and the tooltips, the
 * command palette and the help sheet read their labels from it. One list means
 * a key cannot be advertised in one surface and bound differently in another —
 * which is exactly how the old menu came to promise `M` for mark-read while
 * nothing listened for it.
 *
 * The scheme is mnemonic, one letter per action, Gmail/reader conventions:
 * **S**tar, **M**ark read, **E**archive (the archive key everywhere),
 * **O**pen original, **F**ocus, **A**sk. Modifier keys are reserved for
 * window-level things (palette, rail, theme).
 */
export type ShortcutId =
  | "palette"
  | "ask"
  | "open"
  | "star"
  | "read"
  | "archive"
  | "focus"
  | "rail"
  | "theme"
  | "help";

export interface Shortcut {
  id: ShortcutId;
  label: string;
  /** How the key is shown to a reader. */
  keys: string;
  /** The `KeyboardEvent.key` value, lowercase. */
  key: string;
  mod?: boolean;
  group: "General" | "Document" | "View";
  /** Only fires while a document is open. */
  needsDocument?: boolean;
}

export const SHORTCUTS: Shortcut[] = [
  { id: "palette", label: "Search or run a command", keys: "⌘K", key: "k", mod: true, group: "General" },
  { id: "help", label: "Keyboard shortcuts", keys: "?", key: "?", group: "General" },
  { id: "ask", label: "Ask Curio", keys: "A", key: "a", group: "Document" },
  { id: "open", label: "Open the original", keys: "O", key: "o", group: "Document", needsDocument: true },
  { id: "star", label: "Star or unstar", keys: "S", key: "s", group: "Document", needsDocument: true },
  { id: "read", label: "Mark read or unread", keys: "M", key: "m", group: "Document", needsDocument: true },
  { id: "archive", label: "Archive or unarchive", keys: "E", key: "e", group: "Document", needsDocument: true },
  { id: "focus", label: "Focus mode", keys: "F", key: "f", group: "View" },
  { id: "rail", label: "Toggle the agent rail", keys: "⌘B", key: "b", mod: true, group: "View" },
  { id: "theme", label: "Toggle light and dark", keys: "⌘J", key: "j", mod: true, group: "View" },
];

/** The display key for an action, e.g. `keyFor("star") === "S"`. */
export function keyFor(id: ShortcutId): string {
  return SHORTCUTS.find((shortcut) => shortcut.id === id)?.keys ?? "";
}
