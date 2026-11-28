/**
 * Every keyboard shortcut, in one place.
 *
 * The handler in `Shell` dispatches from this list, and the tooltips, the
 * command palette and the help sheet read their labels from it. One list means
 * a key cannot be advertised in one surface and bound differently in another.
 *
 * The scheme is mnemonic, one letter per action, Gmail/reader conventions:
 * **S**tar, **M**ark read, **E**archive (the archive key everywhere),
 * **O**pen original, **F**ocus, **A**sk. Modifier keys are reserved for
 * window-level things (palette, rail, theme). Destinations use a `G` prefix,
 * the Gmail convention: `G L` for the library, `G H` for highlights, `G T` for
 * topics, `G S` for search, `G ,` for settings.
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
  | "help"
  | "search"
  | "library"
  | "highlights"
  | "review"
  | "topics"
  | "settings";

export interface Shortcut {
  id: ShortcutId;
  label: string;
  /** How the key is shown to a reader. */
  keys: string;
  /** The `KeyboardEvent.key` value, lowercase. */
  key: string;
  mod?: boolean;
  /** A leading key for a two-key sequence, e.g. `g` in `G L`. */
  prefix?: string;
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
  { id: "rail", label: "Toggle the agent rail", keys: "⌘I", key: "i", mod: true, group: "View" },
  { id: "theme", label: "Toggle light and dark", keys: "⌘J", key: "j", mod: true, group: "View" },
  { id: "search", label: "Go to search", keys: "G S", key: "s", prefix: "g", group: "View" },
  { id: "library", label: "Go to library", keys: "G L", key: "l", prefix: "g", group: "View" },
  { id: "highlights", label: "Go to highlights", keys: "G H", key: "h", prefix: "g", group: "View" },
  { id: "review", label: "Go to review", keys: "G R", key: "r", prefix: "g", group: "View" },
  { id: "topics", label: "Go to topics", keys: "G T", key: "t", prefix: "g", group: "View" },
  { id: "settings", label: "Go to settings", keys: "G ,", key: ",", prefix: "g", group: "View" },
];

/** The display key for an action, e.g. `keyFor("star") === "S"`. */
export function keyFor(id: ShortcutId): string {
  return SHORTCUTS.find((shortcut) => shortcut.id === id)?.keys ?? "";
}
