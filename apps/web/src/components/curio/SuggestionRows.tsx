"use client";

import { useEffect, useRef, useState } from "react";
import { useChipDrift } from "./useChipDrift";

/** A media query, read on the client. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = () => setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * The ways into the library as lanes of drifting chips, each lane moving the
 * opposite way to the one above it.
 *
 * More than one row because a single row shows four or five chips, so most of
 * what the library can be asked about is never seen; three lanes show three
 * times as much. Alternating because lanes all moving the same way read as one
 * wide surface sliding past, which pulls the eye sideways — opposite neighbours
 * read as separate lanes, so the movement is texture rather than something to
 * follow.
 */
export function SuggestionRows({
  suggestions,
  onPick,
  disabled,
  lanes = 3,
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
  lanes?: number;
}) {
  // Dealt round-robin, so every lane stays a mix instead of each lane becoming
  // one kind of question.
  const dealt = Array.from({ length: lanes }, (_, lane) =>
    suggestions.filter((_, index) => index % lanes === lane),
  );

  return (
    <div className="flex flex-col gap-2.5">
      {dealt.map((chips, index) => (
        <ChipLane
          key={index}
          chips={chips}
          direction={index % 2 === 0 ? 1 : -1}
          onPick={onPick}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function ChipLane({
  chips,
  direction,
  onPick,
  disabled,
}: {
  chips: string[];
  direction: 1 | -1;
  onPick: (suggestion: string) => void;
  disabled?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rowRef = useRef<HTMLDivElement>(null);

  useChipDrift(rowRef, { playing: !paused && !reduceMotion, direction, wrap: true });

  return (
    <div
      className="suggestions-fade"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      {/* No gap on the scroller and the same gap as padding on each set: that
          makes the scroll width exactly two identical sets, which is the number
          the drift wraps by. */}
      <div ref={rowRef} className="no-scrollbar flex flex-nowrap items-center overflow-x-auto pb-1">
        {[0, 1].map((set) => (
          <div key={set} aria-hidden={set === 1} className="flex flex-nowrap items-center gap-2 pr-2">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onPick(chip)}
                disabled={disabled}
                tabIndex={set === 1 ? -1 : undefined}
                className="shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border border-border px-3 py-1.5 type-caption text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
