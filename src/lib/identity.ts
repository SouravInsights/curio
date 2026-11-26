/**
 * URL and identity helpers, shared by imports and the agent.
 *
 * `externalId` is how a document is known within a library — a normalized URL
 * for a web page, `<source>:<id>` for an import. It is the unique key that makes
 * "I saved this twice" one row, across sources.
 */

/** The form two links are compared in: no scheme, no `www.`, no hash, no trailing slash. */
export function normalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}${url.search}`;
  } catch {
    return input.trim().toLowerCase();
  }
}

/** A web document's identity is its normalized URL. */
export function webExternalId(url: string): string {
  return normalizeUrl(url);
}

/** An imported document's identity is namespaced by its source. */
export function importExternalId(source: string, id: string): string {
  return `${source}:${id}`;
}
