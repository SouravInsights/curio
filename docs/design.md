# Design

Curio is an **app**, not a website with app parts. That single sentence decides
most of what follows, and it is why the primitives ported from the personal site
are wrong here: they were tuned for long-form pages and generous sections, not
for a tool you keep open.

This doc records the decisions the app is built on. Where it says "the
reference", it means a decision taken from a well-made reading app and adopted
deliberately — the numbers below are the ones that were measured, not guessed.

---

## 1. What is actually different about an app

| | A site | An app |
| :--- | :--- | :--- |
| Type | one scale, prose-led, 15px body | two scales: **chrome is small**, the **reading surface is the only large type** |
| Density | generous, scrolls away | dense and persistent; the chrome is always on screen |
| Space | sections and rhythm | panels and seams; a 1px border, not a gap |
| Motion | page transitions, reveals | **instant** on hover and selection; motion only on entrances and exits |
| Colour | brand and mood | **one ladder of surfaces**, and colour is meaning |

## 2. Surfaces — one ladder

Their tokens name three surfaces, and the rest is an alpha on top:

| Their token | What it is |
| :--- | :--- |
| `--color-bg` | the page — the reading column |
| `--color-nav-bg` | **the rail has its own surface**, separate from the page |
| `--card-bg` | the list/agent panel: `color-mix(bg, #fff 3.5%)` in dark |
| `--hover` | `#ffffff0d` — a white alpha, applied to whatever is under it |
| `--cmdk-band` | the palette's selection band, also an alpha |

So there are three surfaces and two alphas, not five surfaces. A panel does not
get "its own colour"; it gets the next step or an alpha.

Every surface is one of five, and a component picks a *role*, never a shade.

| Token | Role | Who uses it |
| :--- | :--- | :--- |
| `--background` | the page | the reading column |
| `--sidebar` | the chrome | rail, list pane, agent rail |
| `--card` | raised | a card inside a panel (a mark, a summary block) |
| `--popover` | floating | popover, dialog, command palette |
| `--accent` | a tint | hover, active chip — **never a surface** |

A floating thing is exactly one step above what it floats over. A popover over
the chrome is `--popover`; a card inside the chrome is `--card`.

## 3. Type — one scale, fourteen steps

Theirs, adopted verbatim. It is denser than the site's and every step has a job:

| Token | Size | Used for |
| :--- | :--- | :--- |
| `--text-2xs` | 11px | the smallest label |
| `--text-xs` | 11.5px | |
| `--text-sm` | 12px | |
| `--text-ui-sm` | 12.5px | |
| `--text-meta` | 13px | counts, secondary row text |
| `--text-byline` | 13.5px | **buttons** — a control is 13.5px, not 14 |
| `--text-base` | 14px | |
| `--text-lg` | 15px | |
| `--text-xl` | 16px | |
| `--text-reading` | 17.5px | the article, sans |
| `--text-reading-serif` | 19px | the article, serif (the default) |
| `--text-2xl` | 20px | |
| `--text-title-small` | 25px | the article title on a phone |
| `--text-title` | 30px | the article title |

Leading: `--leading-tight 1.2`, `--leading-snug 1.3`, `--leading-normal 1.5`,
`--leading-reading 1.68`. Weights: 500 / 600 / 700 — no 400.

## 4. Density — heights are tokens too

| Token | Height | Used for |
| :--- | :--- | :--- |
| `--control-size` | **30px** | buttons and controls. One number for all of them. |
| `--nav-row-height` | 32px | a rail button |
| `--rail-row-height` | 36px | |
| `--list-row-height` | **44px** | a row in the library list |
| `--cmdk-row` | 52px | a palette row — generous, because it is reached for and dismissed |
| `--cmdk-input` | 64px | the palette's field |
| `--cmdk-inset` | 28px | the palette's horizontal padding |
| `--cmdk-gap` | 14px | between a palette row's icon and its label |

Spacing is their 16-step scale: `1,2,4,6,8,10,12,14,16,18,20,24,26,30,32,44`.

## 5. The frame

```
┌────┬──────────────┬───────────────────────────────┬──────────────┐
│    │              │                               │              │
│rail│  list pane   │        reading column         │  agent rail  │
│60px│  flexes      │  640px, or 780px wide         │  slides in   │
│    │              │                               │              │
└────┴──────────────┴───────────────────────────────┴──────────────┘
```

- The rail is `--rail-width: 60px`, `flex: none`, and **has its own background**
  (`--color-nav-bg`). It does not share the page's.
- The reading column is `--reading-column: 640px`, or `--reading-column-wide:
  780px`. **Pixels, not ems** — the ems figure (`--measure-ems: 34`) is the
  reader component's own, and the two are different things.
- The agent rail is a **sheet**: it slides in with `--sheet-shadow`
  (`18px 0 32px -18px`), it is not a grid column that resizes the reader.

- **Rail** — 64px, icon-only, ghost buttons, tooltips on hover. Never labels.
- **List pane** — a header (title · filter · add), then rows. No permanent search
  field: search is a **view**, reached from the rail.
- **Reading column** — the only large type. A measure, not a width; it stays 680
  however wide the pane gets.
- **Agent rail** — segmented tabs, sections, a composer pinned to the bottom.

Panels are separated by a 1px `--border`, never by a gap or a shadow. Shadows are
for things that float.

## 6. The command palette

Theirs is not a search box with commands under it. It is **contextual and flat**:

| Decision | Detail |
| :--- | :--- |
| Header | **what the commands apply to** — the document's favicon and title. Not the app's name. |
| Field | large (`--h-command-input`), placeholder "Type a command or search…" |
| Rows | tall (`--h-command`), `--text-strong`, flat — **no group headings** |
| Keys | **single letters** on the right in a key chip: E archive, F favorite, O open original |
| Selected | `bg-foreground/[0.06]`, no border, no ring |
| Surface | `--popover` |

Global shortcuts (⌘K to open) live in the header hint, not on a row. A hint for a
key that does nothing is a lie, so every chip must be bound.

## 7. Motion

- **Instant** on hover, selection and colour. A fade-out leaves ghost rows behind
  a fast pointer.
- Motion only on **entrances and exits**, 120–260ms, on `opacity` and `scale`.
- One curve per job: `--ease-enter` for something appearing, `--ease-fade-in` for
  something changing size, `--ease-swap` for content replacing content.
- `prefers-reduced-motion` removes all of it.

## 8. Responsive — three breakpoints, each with a job

Theirs. Not a mobile mode bolted on; three thresholds that each change one thing.

**`@media (max-width: 1180px)`** — a two-column grid somewhere collapses.

**`@media (max-width: 719px)`** — the phone breakpoint. This is the interesting
one, because it changes *four* things:

| Change | From → to |
| :--- | :--- |
| `--cmdk-inset` | 28 → **20px** |
| `--cmdk-row` | 52 → **48px** |
| `--cmdk-gap` | 14 → **12px** |
| `._keys_` | **`display: none`** — the shortcut chips are hidden, because a phone has no keyboard |
| palette input | stays 64px tall, font goes to **18px** |
| list | `flex: 1; width: 100%` — full width |
| article | `padding: 28px 24px var(--end-space)` |
| article title | `25px × --reader-scale` |

**`@media (max-width: 700px)`** — the main grid goes to `1fr`, gap 20px.

Two details worth stealing outright:

- **`--end-space: calc(42px * var(--reader-scale, 1))`** — the article's bottom
  padding is a token that scales with the reader's text size. It is what keeps
  the last line clear of the tab bar without a magic number.
- **Hiding the key chips on mobile.** A shortcut hint is only a hint if there is
  a keyboard. Mine shows `⌘B` on a phone, which is worse than noise.

## 9. Primitives: which are ours to keep, which to re-tune

The Radix **behaviour** is worth keeping exactly as-is — focus traps, escape
handling, collision-aware positioning, keyboard navigation. That is the part that
is expensive to get right and easy to get wrong by hand.

The **sizing and type baked into the className** is the site's, and it is wrong
here. These are re-tuned to Curio's tokens:

| Primitive | The site's | Curio's |
| :--- | :--- | :--- |
| `button` | `h-10 text-sm` | `--control-size` (30px), `--text-byline` (13.5px) |
| `input` | `h-10 text-sm` | `--control-size`, `--text-byline` |
| `tabs` | `h-10 text-sm` | `--control-size`, `--text-byline` |
| `command` | `h-11` field, `h-9` rows, 13px | `--cmdk-input` 64, `--cmdk-row` 52, `--cmdk-inset` 28, `--text-xl` 16 |
| `popover` | `w-72 p-4` | `w-48 p-1` for menus, `p-4` for content |

Z-index is a scale too, not a guess: `--z-bar: 50`, `--z-dialog: 80`,
`--z-drop: 300`.

Anything a component needs that is not a token is a gap in this doc, not a reason
for a number.
