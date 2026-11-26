import type { ImportedDocument } from "./types";
import { importExternalId, normalizeUrl } from "@curio/core/lib/identity";

/**
 * Reading-list imports. Each returns documents; the pipeline does the rest.
 *
 * These are parsers, not crawlers: a browser bookmark file and a Readwise export
 * both list URLs, and the pipeline fetches and reads each one. A Kindle export
 * carries its own text, so it skips the fetch.
 */

/** Netscape bookmark HTML — what every browser exports. */
export async function parseBookmarks(content: string): Promise<ImportedDocument[]> {
  const anchors = content.matchAll(
    /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  );
  const out: ImportedDocument[] = [];
  const seen = new Set<string>();

  for (const match of anchors) {
    const url = match[1]!;
    if (!/^https?:/i.test(url)) continue;
    const key = normalizeUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const title = match[2]!.replace(/<[^>]+>/g, "").trim();
    out.push({
      kind: "article",
      externalId: importExternalId("bookmarks", key),
      url,
      title,
    });
  }
  return out;
}

/**
 * A Readwise-style CSV export: `Title,Author,URL,Category,...` with the header
 * in the first row. Only the columns that exist are used.
 */
export async function parseReadwiseCsv(content: string): Promise<ImportedDocument[]> {
  const rows = splitCsv(content);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const get = (row: string[], name: string) => {
    const i = col(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const out: ImportedDocument[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const url = get(row, "url") || get(row, "source_url");
    const title = get(row, "title");
    if (!url && !title) continue;
    const key = url ? normalizeUrl(url) : title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: get(row, "category") === "books" ? "book" : "article",
      externalId: importExternalId("readwise", key),
      url: url || undefined,
      title,
      author: get(row, "author") || undefined,
    });
  }
  return out;
}

/** A Kindle `My Clippings.txt` export: title line, metadata, blank, highlight. */
export async function parseKindleClippings(content: string): Promise<ImportedDocument[]> {
  const out: ImportedDocument[] = [];
  const blocks = content.split(/\r?\n==========\r?\n/);

  const byTitle = new Map<string, string[]>();
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) continue;
    const title = lines[0]!.replace(/\s*\(.*\)\s*$/, "").trim();
    const text = lines.slice(2).join("\n").trim();
    if (!text) continue;
    const highlights = byTitle.get(title) ?? [];
    highlights.push(`> ${text}`);
    byTitle.set(title, highlights);
  }

  for (const [title, highlights] of byTitle) {
    out.push({
      kind: "book",
      externalId: importExternalId("kindle", title.toLowerCase().replace(/\s+/g, "-")),
      title,
      markdown: `# ${title}\n\n${highlights.join("\n\n")}`,
    });
  }
  return out;
}

/** A local markdown or plain-text file. */
export function parseMarkdown(content: string, label: string): ImportedDocument[] {
  const first = content.split("\n").find((l) => l.startsWith("# "));
  return [
    {
      kind: "note",
      externalId: importExternalId("file", label),
      title: first ? first.replace(/^#\s+/, "").trim() : label,
      markdown: content,
    },
  ];
}

/** Minimal CSV splitter that handles quoted fields. */
function splitCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
