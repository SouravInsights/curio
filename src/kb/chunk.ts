import { getEncoding } from "js-tiktoken";

/**
 * chunk — split markdown into embedding-sized passages, with offsets.
 *
 * This is the site's chunker (`src/lib/kb/chunk.ts`) plus the one thing a
 * reading harness needs and a links page did not: **every passage knows its
 * character offset and line range in the stored markdown.** That is what makes a
 * line-level citation possible — a citation points at `startLine..endLine` and
 * the reader scrolls there.
 *
 * Consequences of being offset-exact:
 * - `content` is the literal `markdown.slice(startOffset, endOffset)`, so the
 *   span in the source and the span in the citation are the same text. A passage
 *   that spans a heading includes that heading line, which is honest.
 * - Overlap between consecutive passages is real overlap: the next passage
 *   starts at an earlier offset, and its line range says so.
 *
 * Headings define sections, fenced code is its own unit kind, and the ~500-token
 * budget and ~15% overlap are unchanged.
 */

export const MAX_TOKENS = 500;
const OVERLAP_TOKENS = 75;
const CODE_MAX_TOKENS = 900;

const encoder = getEncoding("cl100k_base");
const tokensOf = (text: string) => encoder.encode(text).length;

export interface ChunkUnit {
  index: number;
  content: string;
  unitType: "prose" | "code";
  heading: string | null;
  tokenCount: number;
  /** What actually gets embedded: title + heading path in front of the text. */
  embeddingText: string;
  startOffset: number;
  endOffset: number;
  /** 1-based line numbers into the document's markdown. */
  startLine: number;
  endLine: number;
}

interface Block {
  kind: "prose" | "code";
  text: string;
  heading: string | null;
  startOffset: number;
  endOffset: number;
}

interface Piece {
  text: string;
  startOffset: number;
  endOffset: number;
}

/** 1-based line for a character offset. */
export function lineOf(markdown: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, markdown.length);
  for (let i = 0; i < end; i++) if (markdown.charCodeAt(i) === 10) line++;
  return line;
}

/** Walk markdown into prose blocks and code fences, tracking headings and offsets. */
function blocksOf(markdown: string): Block[] {
  const blocks: Block[] = [];
  const headingStack = new Map<number, string>();
  const lines = markdown.split("\n");

  // Absolute start offset of each line.
  const starts: number[] = [];
  let acc = 0;
  for (const line of lines) {
    starts.push(acc);
    acc += line.length + 1;
  }

  const headingLevels = () => [...headingStack.keys()].sort((a, b) => a - b);
  const currentHeading = () => {
    const levels = headingLevels();
    return levels.length ? levels.map((l) => headingStack.get(l)).join(" › ") : null;
  };

  let proseStart = -1;
  let proseEnd = -1;
  let codeStart = -1;

  const flushProse = () => {
    if (proseStart < 0) return;
    const text = markdown.slice(proseStart, proseEnd);
    if (text.trim()) {
      blocks.push({
        kind: "prose",
        text,
        heading: currentHeading(),
        startOffset: proseStart,
        endOffset: proseEnd,
      });
    }
    proseStart = -1;
    proseEnd = -1;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (codeStart >= 0) {
      if (line.startsWith("```")) {
        const codeEnd = starts[i]! + line.length;
        blocks.push({
          kind: "code",
          text: markdown.slice(codeStart, codeEnd),
          heading: currentHeading(),
          startOffset: codeStart,
          endOffset: codeEnd,
        });
        codeStart = -1;
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushProse();
      codeStart = starts[i]!;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)/.exec(line);
    if (heading) {
      flushProse();
      const level = heading[1]!.length;
      headingStack.set(level, heading[2]!.trim());
      for (const l of headingLevels()) if (l > level) headingStack.delete(l);
      continue;
    }

    if (!line.trim()) {
      flushProse();
      continue;
    }

    if (proseStart < 0) proseStart = starts[i]!;
    proseEnd = starts[i]! + line.length;
  }

  if (codeStart >= 0) {
    blocks.push({
      kind: "code",
      text: markdown.slice(codeStart),
      heading: currentHeading(),
      startOffset: codeStart,
      endOffset: markdown.length,
    });
  }
  flushProse();
  return blocks;
}

/** Split a giant paragraph into word windows, keeping offsets. */
function windowProse(block: Block): Piece[] {
  const text = block.text;
  if (tokensOf(text) <= MAX_TOKENS) {
    return [{ text, startOffset: block.startOffset, endOffset: block.endOffset }];
  }

  const words: { w: string; start: number }[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) words.push({ w: match[0], start: match.index });

  const pieces: Piece[] = [];
  let buffer: typeof words = [];
  let bufferTokens = 0;

  const flush = () => {
    if (!buffer.length) return;
    const first = buffer[0]!;
    const last = buffer[buffer.length - 1]!;
    pieces.push({
      text: text.slice(first.start, last.start + last.w.length),
      startOffset: block.startOffset + first.start,
      endOffset: block.startOffset + last.start + last.w.length,
    });
    buffer = [];
    bufferTokens = 0;
  };

  for (const word of words) {
    const wordTokens = tokensOf(word.w);
    if (bufferTokens + wordTokens > MAX_TOKENS && buffer.length) flush();
    buffer.push(word);
    bufferTokens += wordTokens;
  }
  flush();
  return pieces;
}

/** Split a code wall into line windows with a small overlap, keeping offsets. */
function windowCode(block: Block): Piece[] {
  const text = block.text;
  if (tokensOf(text) <= CODE_MAX_TOKENS) {
    return [{ text, startOffset: block.startOffset, endOffset: block.endOffset }];
  }

  const lines: { t: string; start: number; tokens: number }[] = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    lines.push({ t: line, start: offset, tokens: tokensOf(line) });
    offset += line.length + 1;
  }

  const pieces: Piece[] = [];
  let buffer: typeof lines = [];
  let tokens = 0;

  const flush = () => {
    if (!buffer.length) return;
    const first = buffer[0]!;
    const last = buffer[buffer.length - 1]!;
    pieces.push({
      text: text.slice(first.start, last.start + last.t.length),
      startOffset: block.startOffset + first.start,
      endOffset: block.startOffset + last.start + last.t.length,
    });
    // Keep the last ~50 tokens as the next window's first lines.
    const overlap: typeof lines = [];
    let overlapTokens = 0;
    for (let i = buffer.length - 1; i >= 0 && overlapTokens < 50; i--) {
      overlap.unshift(buffer[i]!);
      overlapTokens += buffer[i]!.tokens;
    }
    buffer = overlap;
    tokens = overlapTokens;
  };

  for (const line of lines) {
    if (tokens + line.tokens > CODE_MAX_TOKENS && buffer.length) flush();
    buffer.push(line);
    tokens += line.tokens;
  }
  // The final buffer may be pure overlap — do not emit it twice.
  if (buffer.length && tokens > 0 && buffer !== lines) {
    const first = buffer[0]!;
    const last = buffer[buffer.length - 1]!;
    const piece = {
      text: text.slice(first.start, last.start + last.t.length),
      startOffset: block.startOffset + first.start,
      endOffset: block.startOffset + last.start + last.t.length,
    };
    const lastPiece = pieces[pieces.length - 1];
    if (!lastPiece || lastPiece.endOffset < piece.endOffset) pieces.push(piece);
  }
  return pieces;
}

export function chunkMarkdown(markdown: string, opts: { title: string }): ChunkUnit[] {
  const prefix = (heading: string | null) => (heading ? `${opts.title} › ${heading}` : opts.title);

  const units: Omit<ChunkUnit, "index" | "startLine" | "endLine">[] = [];

  const push = (input: Omit<ChunkUnit, "index" | "startLine" | "endLine" | "embeddingText">) => {
    units.push({ ...input, embeddingText: `${prefix(input.heading)}: ${input.content}` });
  };

  let carry: Block[] = [];
  let carryTokens = 0;
  let run: Block[] = [];
  let runTokens = 0;

  const flushRun = () => {
    if (!run.length) return;
    const first = run[0]!;
    const last = run[run.length - 1]!;
    const content = markdown.slice(first.startOffset, last.endOffset);
    push({
      content,
      unitType: "prose",
      heading: last.heading,
      tokenCount: tokensOf(content),
      startOffset: first.startOffset,
      endOffset: last.endOffset,
    });
    carry = [];
    carryTokens = 0;
    for (let i = run.length - 1; i >= 0 && carryTokens < OVERLAP_TOKENS; i--) {
      carry.unshift(run[i]!);
      carryTokens += tokensOf(run[i]!.text);
    }
    run = [];
    runTokens = 0;
  };

  for (const block of blocksOf(markdown)) {
    if (block.kind === "code") {
      flushRun();
      carry = [];
      carryTokens = 0;
      for (const window of windowCode(block)) {
        push({
          content: window.text,
          unitType: "code",
          heading: block.heading,
          tokenCount: tokensOf(window.text),
          startOffset: window.startOffset,
          endOffset: window.endOffset,
        });
      }
      continue;
    }

    const blockTokens = tokensOf(block.text);

    if (blockTokens > MAX_TOKENS) {
      flushRun();
      for (const piece of windowProse(block)) {
        push({
          content: piece.text,
          unitType: "prose",
          heading: block.heading,
          tokenCount: tokensOf(piece.text),
          startOffset: piece.startOffset,
          endOffset: piece.endOffset,
        });
      }
      continue;
    }

    if (runTokens + blockTokens > MAX_TOKENS && run.length) flushRun();

    if (carry.length) {
      run = [...carry];
      runTokens = carryTokens;
      carry = [];
      carryTokens = 0;
    }

    run.push(block);
    runTokens += blockTokens;
  }
  flushRun();

  return units.map((unit, index) => ({
    ...unit,
    index,
    startLine: lineOf(markdown, unit.startOffset),
    endLine: lineOf(markdown, Math.max(unit.startOffset, unit.endOffset - 1)),
  }));
}
