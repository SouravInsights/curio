import type { Annotation } from "./api";
import { paint as huePaint } from "@/lib/highlight-palette";

/**
 * Paint saved highlights onto rendered markdown.
 *
 * The anchor is the site's rule, and it is a good one: `quote` + `occurrence`.
 * A re-read that shifts the page doesn't move the mark, because the words are
 * the anchor, not an offset. If the quote is gone, the mark simply doesn't
 * paint — the row stays in the database, marked `stale` server-side.
 *
 * Runs after React renders, on the article's DOM. Every quote is wrapped in a
 * `<mark>` carrying its annotation id, which the reader uses to open it.
 */

function textNodesOf(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  return nodes;
}

function rangeFrom(nodes: Text[], start: number, end: number): Range | null {
  let position = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const node of nodes) {
    const length = node.nodeValue?.length ?? 0;
    if (!startNode && start >= position && start <= position + length) {
      startNode = node;
      startOffset = start - position;
    }
    if (!endNode && end >= position && end <= position + length) {
      endNode = node;
      endOffset = end - position;
    }
    position += length;
  }
  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, blockquote, td";

/** Wrap the matching occurrence of a quote inside one block. Returns true when painted. */
function paint(block: Element, annotation: Annotation): boolean {
  const nodes = textNodesOf(block);
  const text = nodes.map((n) => n.nodeValue ?? "").join("");
  const quote = annotation.quote;
  if (!quote || !text.includes(quote)) return false;

  let index = text.indexOf(quote);
  let seen = 0;
  while (index !== -1) {
    if (seen === (annotation.occurrence ?? 0)) {
      const range = rangeFrom(nodes, index, index + quote.length);
      if (!range) return false;
      const mark = document.createElement("mark");
      const { ink, wash } = huePaint(
        annotation.hue ?? 2,
        document.documentElement.classList.contains("dark"),
      );
      mark.className = "hl";
      mark.style.backgroundColor = wash;
      mark.style.color = ink;
      mark.dataset.annotationId = String(annotation.id);
      try {
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
      } catch {
        return false;
      }
      return true;
    }
    seen++;
    index = text.indexOf(quote, index + 1);
  }
  return false;
}

/** Paint every annotation onto the article. Idempotent — it repaints from scratch. */
export function applyHighlights(root: HTMLElement, annotations: Annotation[]): number {
  root.querySelectorAll("mark.hl").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });

  const blocks = Array.from(root.querySelectorAll(BLOCKS));
  let painted = 0;
  for (const annotation of annotations) {
    for (const block of blocks) {
      if (paint(block, annotation)) {
        painted++;
        break;
      }
    }
  }
  return painted;
}
