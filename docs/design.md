# Design

Curio is an app, not a website with app parts. That decides most of what
follows: primitives tuned for a long-form page suit generous sections that
scroll away, not a tool you keep open. `packages/ui/src/styles/tokens.css` holds
the values; this records the decisions behind them.

## Surfaces

One ladder. A component picks a role, never a shade.

| Token | Role |
| :--- | :--- |
| `--background` | the page — the reading column |
| `--sidebar` | the chrome: rail, list pane, agent rail |
| `--card` | raised: a card inside a panel |
| `--popover` | floating above everything |
| `--accent` | a hover or an active chip, never a surface |

A floating thing is one step above what it floats over. Hover and borders are
alphas of the text colour, so they work on any surface. Colour that means
something — gold, red, the accent — is its own token, never a shade of grey.

## Elevation

A floating surface is a **0.5px hairline plus one soft black blur**. The hairline
is the edge: half a pixel, so it reads as light catching the surface and not as a
border. One blur, never layered — stacked blurs flatten the depth and each layer
shows its own edge.

| Token | For |
| :--- | :--- |
| `--shadow-tip` | tooltip |
| `--shadow-popover` | menu, popover, hover card |
| `--shadow-panel` | dialog, command palette |
| `--shadow-card` | a raised card |
| `--shadow-sheet` | a sheet |
| `--shadow-float` | toast |

They are consumed through the `boxShadow` scale (`shadow-tip`, …), never as
`shadow-[var(--shadow-tip)]` — Tailwind parses that as a shadow *colour* and
renders nothing.

A floating surface has no border and no 1px ring. A border is right only for a
panel that is part of the page.

## Type

Chrome is small; the reading surface is the only large type.

| Token | Size | For |
| :--- | :--- | :--- |
| `--text-label` | 11px | the smallest label |
| `--text-meta` | 12px | counts, secondary rows |
| `--text-ui` | 13px | body text in chrome |
| `--text-byline` | 13.5px | buttons and controls |
| `--text-strong` | 15px | a row's title |
| `--text-reading` | 17.5px | the article, sans |
| `--text-reading-serif` | 19px | the article, serif (default) |
| `--text-title` | 25px | the article title, narrow |
| `--text-display` | 30px | the article title |

Leading is a step too: `--leading-tight` 1.2, `--leading-snug` 1.3,
`--leading-normal` 1.5, `--leading-reading` 1.68.

## Radius

| Token | | For |
| :--- | :--- | :--- |
| `--radius-sm` | 4px | a key chip |
| `--radius-md` | 6px | a tooltip |
| `--radius-control` | 7px | a button, an input |
| `--radius-row` | 8px | a list row, a menu item |
| `--radius-card` | 10px | a popover, a menu |
| `--radius-panel` | 14px | a dialog, the palette, a sheet |

A nested corner sits clean when the inner radius is the outer minus the padding.

## Density

| Token | | For |
| :--- | :--- | :--- |
| `--h-control` | 32px | a button, an input |
| `--h-tab` | 30px | a tab |
| `--h-row` | 56px | a list row |
| `--cmdk-row` | 52px | a palette row |
| `--cmdk-input` | 64px | the palette field |
| `--cmdk-inset` | 28px | the palette's horizontal padding |

Spacing is a 4px scale, `--space-1` (4px) to `--space-14` (44px).

## The frame

```
┌────┬──────────────┬───────────────────────────────┬──────────────┐
│    │              │ header: trigger · actions      │              │
│rail│  list pane   ├───────────────────────────────┤  agent rail  │
│64px│  resizable   │        reading column         │  resizable   │
│    │              │                               │              │
└────┴──────────────┴───────────────────────────────┴──────────────┘
```

- The rail is 64px, icon-only, and never collapses. It is a sibling of the
  panels, so hiding the list leaves the rail — and its destinations — on screen.
- The list pane and the agent rail are resizable (`react-resizable-panels`) with
  the pill handle. They collapse by unmounting, so the reader gets the full
  width with no leftover gutter. Defaults are pinned to pixels — list 320px,
  agent 400px — and converted to the group's percentages at render, because a
  fixed percentage is 330px on a laptop and 660px on a large display.
- The content header is 48px, above the reading column, with a bottom border. A
  panel trigger sits at each edge — the library on the left, the agent on the
  right — with the reader toolbar between them. A trigger lives here, not inside
  the panel it controls: a control that hides itself with the thing it controls
  cannot bring it back. The right trigger is the left one mirrored.
- Focus mode (`F`, or the palette) closes both panels at once; the two triggers
  each close one.
- The agent rail mounts only while Ask is open, so it never steals width from the
  reader when closed.

The list pane is a header (title · filter · add) and rows. Search is a **view**,
reached from the rail, not a field parked above the list. The reading column is
the only large type.

Panels are separated by a 1px `--border`, never by a gap or a shadow. Shadows are
for things that float.

## Motion

- Instant on hover, selection and colour. A fade-out leaves ghost rows behind a
  fast pointer.
- Motion only on entrances and exits, 120–260ms, on `opacity` and `scale`.
- One curve per job: `--ease-enter` for something appearing, `--ease-fade-in` for
  something changing size, `--ease-swap` for content replacing content.
- `prefers-reduced-motion` removes all of it.

## Responsive

Below 768px the shell is one column: the list or the reader, a bottom bar, and
the agent as a sheet. The palette tightens — `--cmdk-row` 52 → 48px,
`--cmdk-inset` 28 → 20px, `--cmdk-gap` 14 → 12px — and the shortcut chips go: a
key hint is only a hint if there is a keyboard.

## Primitives

Radix owns the behaviour — focus traps, escape handling, collision-aware
positioning, keyboard navigation. The sizing and type are ours:

| Primitive | Ours |
| :--- | :--- |
| `button` | `--h-control`, `--text-byline` |
| `input` | `--h-input`, `--text-byline` |
| `tabs` | `--h-tab`, `--text-ui` |
| `command` | `--cmdk-input`, `--cmdk-row`, `--cmdk-inset` |
| `popover` | `--radius-card`, no border, `shadow-popover` |
| `tooltip` | `--radius-md`, `px-2 py-[5px]`, `--text-meta`, `shadow-tip` |
| `dialog` | `--radius-panel`, no border, `shadow-panel` |

Layers are a scale: `--z-drop` 50, `--z-modal` 60.

A value a component needs that is not a token is a gap in the system, not a
reason for a magic number.
