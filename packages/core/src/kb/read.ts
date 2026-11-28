import { JSDOM, VirtualConsole } from "jsdom";

// Modern CSS (color-mix, range syntax) makes jsdom's parser noisy. The CSS is
// irrelevant to extraction — read in silence.
const silentConsole = new VirtualConsole();

/**
 * read — one page's HTML becomes clean markdown + metadata, via defuddle.
 *
 * defuddle never executes JavaScript; the caller decides when a rendered page is
 * needed and passes that HTML in here. `useAsync: false` keeps reads
 * deterministic and offline: no extractor fetches third-party APIs mid-parse.
 *
 * The same seam serves imported HTML — a newsletter's email body, a saved
 * bookmark file's page — since all of it is "HTML in, markdown out".
 */

export interface PageRead {
  markdown: string;
  title: string;
  description: string;
  author: string;
  site: string;
  wordCount: number;
  extractorType?: string;
}

export const wordCount = (text: string) => (text ? text.split(/\s+/).filter(Boolean).length : 0);

type DefuddleFn = typeof import("defuddle/node").Defuddle;

/**
 * `defuddle/node` is CommonJS behind an import-only export map. Accept either
 * module shape (`{ Defuddle }` or `{ default: { Defuddle } }`) so a bundler and
 * Node's loader can disagree without breaking the read.
 */
async function loadDefuddle(): Promise<DefuddleFn> {
  const mod = (await import("defuddle/node")) as {
    Defuddle?: DefuddleFn;
    default?: DefuddleFn | { Defuddle?: DefuddleFn };
  };
  const candidate =
    mod.Defuddle ?? (typeof mod.default === "function" ? mod.default : mod.default?.Defuddle);
  if (typeof candidate !== "function") {
    throw new Error(`defuddle/node did not expose Defuddle (keys: ${Object.keys(mod).join(", ")})`);
  }
  return candidate;
}

export async function readPage(html: string, url: string): Promise<PageRead | null> {
  try {
    const Defuddle = await loadDefuddle();
    const dom = new JSDOM(html, { url, virtualConsole: silentConsole });
    const result = await Defuddle(dom.window.document, url, {
      markdown: true,
      useAsync: false,
    });
    if (!result?.content?.trim()) {
      console.warn("readPage: defuddle returned no content", { url, htmlChars: html.length });
      return null;
    }

    return {
      markdown: result.content.trim(),
      title: result.title ?? "",
      description: result.description ?? "",
      author: result.author ?? "",
      site: result.site ?? "",
      wordCount: result.wordCount || wordCount(result.content),
      extractorType: result.extractorType,
    };
  } catch (error) {
    console.warn("readPage: threw", {
      url,
      htmlChars: html.length,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
