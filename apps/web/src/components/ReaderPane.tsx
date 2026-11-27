"use client";

import { useRef } from "react";
import { useState } from "react";
import {
  ArrowLeft,
  Archive,
  ArrowSquareOut,
  ArrowUUpLeft,
  CheckCircle,
  CornersOut,
  Star,
} from "@phosphor-icons/react";
import { Kbd } from "@curio/ui/components/ui/kbd";
import { cn } from "@curio/ui/lib/utils";
import { TOOLBAR_ACTIVE, TOOLBAR_BUTTON } from "@/lib/toolbar";
import { keyFor } from "@/lib/shortcuts";
import type { DocumentDetail } from "@/lib/api";
import { Highlight, type CreatePayload } from "@curio/ui/components/highlight/highlight";
import { Button } from "@curio/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@curio/ui/components/tooltip";
import { Markdown } from "./Markdown";
import { Skeleton, SkeletonGroup, ShimmerText } from "./Loading";
import {
  ReaderAppearance,
  appearanceStyle,
  type Appearance,
} from "./ReaderAppearance";

/** One button in the reader toolbar. `active` paints the on state. */
function toolbarButton(active = false) {
  return cn(TOOLBAR_BUTTON, active && TOOLBAR_ACTIVE);
}

/**
 * The reading surface.
 *
 * The highlight system is the `Highlight` component, mounted as a sibling of
 * the element it scans and never inside it, so the engine's own live region
 * does not end up in the paragraph list.
 */
export function ReaderPane({
  doc,
  onCreate,
  onRecolor,
  onDelete,
  onShareQuote,
  onArchive,
  onUnarchive,
  onMarkRead,
  onToggleFavorite,
  appearance,
  onAppearance,
  onBack,
  renderToolbar = true,
  loading = false,
  pendingUrl = null,
  loadingTitle = null,
}: {
  doc: DocumentDetail | null;
  onCreate: (payload: CreatePayload) => Promise<number | null>;
  onRecolor: (id: number, hue: number) => void;
  onDelete: (id: number) => void;
  onShareQuote: (payload: { quote: string; context: string }) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onMarkRead: () => void;
  onToggleFavorite: () => void;
  appearance: Appearance;
  onAppearance: (value: Appearance) => void;
  /** Mobile only: return to the list. */
  onBack?: () => void;
  /**
   * Whether the pane draws its own floating toolbar. Desktop sets this false
   * and the shell renders `ReaderToolbar` in the content header instead; the
   * phone has no header, so it keeps the floating row.
   */
  renderToolbar?: boolean;
  /** The document request is in flight and nothing is cached yet. */
  loading?: boolean;
  /** The title already known from the list, so the loading title can shimmer. */
  loadingTitle?: string | null;
  /** A link being read right now, when nothing is open to show it in. */
  pendingUrl?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (pendingUrl) return <ReaderLoading label={`Reading ${hostOf(pendingUrl)}…`} title={pendingUrl} />;
  if (loading) return <ReaderLoading label="Opening the document…" title={loadingTitle} />;

  if (!doc) {
    return (
      <section className="flex h-full min-w-0 items-center justify-center">
        <p className="type-caption">Pick something to read.</p>
      </section>
    );
  }

  // The header's two lines, split by role: **where it came from** (the source,
  // with its favicon) and **what it costs you** (the read time, and when you
  // saved it). The old single line mixed both and buried the source.
  const host = (() => {
    try {
      return doc.url ? new URL(doc.url).hostname.replace(/^www\./, "") : "";
    } catch {
      return "";
    }
  })();
  const readMinutes = doc.wordCount ? Math.max(1, Math.round(doc.wordCount / 200)) : null;
  const saved = doc.addedAt
    ? `saved ${new Date(doc.addedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : null;
  const meta = [doc.author, readMinutes ? `${readMinutes} min read` : null, saved]
    .filter(Boolean)
    .join(" · ");

  // The markdown usually opens with its own `# Title`, which we render from
  // metadata. Drop the duplicate rather than printing the title twice.
  const markdown = (doc.markdown ?? "").replace(/^#\s+(.+?)\s*\n+/, (match, text: string) =>
    text.trim().toLowerCase() === (doc.title ?? "").trim().toLowerCase() ? "" : match,
  );

  return (
    <section className="relative flex h-full min-w-0 flex-col bg-background">
      {renderToolbar ? (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-[var(--radius-card)] border border-border/60 bg-background/85 p-1 backdrop-blur">
          <ReaderToolbar
            doc={doc}
            onBack={onBack}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onMarkRead={onMarkRead}
            onToggleFavorite={onToggleFavorite}
            appearance={appearance}
            onAppearance={onAppearance}
          />
        </div>
      ) : null}

      <div className="scroll-contain min-h-0 flex-1 overflow-y-auto">
        <article
          className="reader-prose prose prose-neutral mx-auto px-6 py-20 dark:prose-invert"
          style={{
            maxWidth: appearance.width === "narrow" ? "var(--measure-narrow)" : "var(--measure)",
            ...appearanceStyle(appearance),
          }}
        >
          {/* Three things, in order: what it is, where it came from, what it
              costs. The title is the only large type; the source is the one
              link; the rest is faint. `not-prose` keeps the plugin's margins
              off the header — see the note on the article. */}
          <header className="not-prose border-b border-border/60 pb-6">
            <h1 className="type-display text-balance">{doc.title || doc.externalId}</h1>
            {doc.url ? (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3.5 inline-flex items-center gap-1.5 type-caption font-medium text-green-600 underline-offset-2 hover:underline dark:text-green-500"
              >
                {host ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${host}`}
                    alt=""
                    width={14}
                    height={14}
                    loading="lazy"
                    className="h-3.5 w-3.5 rounded-[2px]"
                  />
                ) : null}
                {doc.site || host}
              </a>
            ) : null}
            {meta ? <p className="mt-1.5 type-caption text-faint-foreground">{meta}</p> : null}
          </header>
          <div ref={containerRef} className="mt-7">
            {markdown ? <Markdown>{markdown}</Markdown> : <p>No stored text for this document.</p>}
          </div>
        </article>
      </div>

      <Highlight
        containerRef={containerRef}
        editable
        initialMarks={doc.annotations.map((a) => ({
          id: a.id,
          quote: a.quote,
          occurrence: a.occurrence,
          hue: a.hue,
        }))}
        onCreate={onCreate}
        onRecolor={onRecolor}
        onDelete={onDelete}
        onShareQuote={onShareQuote}
      />
    </section>
  );
}

export interface ReaderToolbarProps {
  doc: DocumentDetail | null;
  onArchive: () => void;
  onUnarchive: () => void;
  onMarkRead: () => void;
  onToggleFavorite: () => void;
  appearance: Appearance;
  onAppearance: (value: Appearance) => void;
  /** Desktop only: the focus-mode toggle. The phone has no panels to hide. */
  onToggleFocus?: () => void;
  /** Whether focus mode is on — both panels out of the way. */
  focus?: boolean;
  /** Mobile only: return to the list. */
  onBack?: () => void;
}

/**
 * The reader's controls, one row.
 *
 * Desktop renders this in the content header, beside the sidebar trigger, so
 * the controls stay put while the library list opens and closes. The phone has
 * no header to put it in, so the pane keeps it floating over the article.
 *
 * One row, one button size, one radius. The floating container is
 * `--radius-card` (10px) with `p-1` (4px), so the buttons are `--radius-md`
 * (6px): a nested corner only sits clean when the inner radius is the outer
 * minus the padding. Dividers group document actions, view controls, and the
 * one destructive action.
 */
export function ReaderToolbar({
  doc,
  onArchive,
  onUnarchive,
  onMarkRead,
  onToggleFavorite,
  appearance,
  onAppearance,
  onToggleFocus,
  focus,
  onBack,
}: ReaderToolbarProps) {
  // Any popper open in the toolbar. Tooltips stand down while one is, so a
  // tooltip never renders beneath an open menu.
  const [popperOpen, setPopperOpen] = useState(false);

  if (!doc) return null;

  return (
    <div className="flex items-center gap-1">
      {onBack
        ? tip(
            "Back to list",
            null,
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to list"
              onClick={onBack}
              className={toolbarButton()}
            >
              <ArrowLeft />
            </Button>,
            popperOpen,
          )
        : null}

      {doc.url
        ? tip(
            "Open original",
            keyFor("open"),
            <Button variant="ghost" size="icon" asChild className={toolbarButton()}>
              <a href={doc.url} target="_blank" rel="noreferrer" aria-label="Open original">
                <ArrowSquareOut />
              </a>
            </Button>,
            popperOpen,
          )
        : null}

      {tip(
        doc.favorite ? "Unstar" : "Star",
        keyFor("star"),
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFavorite}
          aria-label={doc.favorite ? "Unstar" : "Star"}
          aria-pressed={doc.favorite}
          className={cn(toolbarButton(doc.favorite), doc.favorite && "text-[var(--favorite)]")}
        >
          <Star weight={doc.favorite ? "fill" : "regular"} />
        </Button>,
        popperOpen,
      )}

      {tip(
        doc.readState === "read" ? "Mark as unread" : "Mark as read",
        keyFor("read"),
        <Button
          variant="ghost"
          size="icon"
          onClick={onMarkRead}
          aria-label={doc.readState === "read" ? "Mark as unread" : "Mark as read"}
          aria-pressed={doc.readState === "read"}
          className={toolbarButton(doc.readState === "read")}
        >
          <CheckCircle weight={doc.readState === "read" ? "fill" : "regular"} />
        </Button>,
        popperOpen,
      )}

      {/* Content, not an action: the appearance controls are a popover. */}
      <ReaderAppearance
        value={appearance}
        onChange={onAppearance}
        onOpenChange={setPopperOpen}
      />

      {/* Focus mode: both panels out of the way. It lives here, not on a key
          alone, because a shortcut you have to already know is not a control. */}
      {onToggleFocus
        ? tip(
            "Focus mode",
            keyFor("focus"),
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFocus}
              aria-label="Focus mode"
              aria-pressed={focus}
              className={toolbarButton(focus)}
            >
              <CornersOut />
            </Button>,
            popperOpen,
          )
        : null}

      {/* The one destructive action. It turns red on hover but stays in the
          toolbar: it is used often enough to be a first-class action, and it is
          reversible. A menu for one command is worse than a separated button. */}
      {doc.readState === "archived"
        ? tip(
            "Unarchive",
            keyFor("archive"),
            <Button
              variant="ghost"
              size="icon"
              onClick={onUnarchive}
              aria-label="Unarchive"
              className={toolbarButton()}
            >
              <ArrowUUpLeft />
            </Button>,
            popperOpen,
          )
        : tip(
            "Archive",
            keyFor("archive"),
            <Button
              variant="ghost"
              size="icon"
              onClick={onArchive}
              aria-label="Archive"
              className={cn(toolbarButton(), "hover:bg-destructive/10 hover:text-destructive")}
            >
              <Archive />
            </Button>,
            popperOpen,
          )}
    </div>
  );
}

/**
 * A tooltip for a toolbar control.
 *
 * Suppressed while a popover or menu is open. Two reasons, and the second is the
 * one that matters: a tooltip rendering *under* an open menu reads as a bug, and
 * the offset here is the same as the popper's so the two never look like
 * different components.
 */
function tip(label: string, shortcut: string | null, node: React.ReactNode, suppressed: boolean) {
  return suppressed ? node : <Tip label={label} shortcut={shortcut}>{node}</Tip>;
}

function Tip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut: string | null;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The reading surface before the document arrives. The title is the link's
 * URL, and it shimmers through the text; the body is twelve swept blocks with
 * the same widths and stagger Matter uses. The title stays a real title, so the
 * page never loses its shape while the body loads.
 */
function ReaderLoading({ label, title }: { label: string; title?: string | null }) {
  return (
    <section className="relative flex h-full min-w-0 flex-col bg-background">
      <div className="scroll-contain min-h-0 flex-1 overflow-y-auto">
        <article
          className="reader-prose mx-auto px-6 py-20"
          style={{ maxWidth: "var(--measure)" }}
        >
          <SkeletonGroup label={label}>
            <header className="not-prose border-b border-border/60 pb-6">
              {title ? (
                <h1 className="type-display break-words">
                  <ShimmerText>{title}</ShimmerText>
                </h1>
              ) : (
                <Skeleton className="h-9 w-2/3" />
              )}
            </header>
            <div className="mt-7 flex flex-col gap-[18px]">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-2.5 rounded-[5px]"
                  style={{
                    width: `${i % 4 === 3 ? 46 + ((i * 13) % 20) : 88 + ((i * 7) % 12)}%`,
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              ))}
            </div>
          </SkeletonGroup>
        </article>
      </div>
    </section>
  );
}
