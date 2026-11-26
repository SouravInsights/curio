/**
 * get — the one network seam. Given a URL, return its HTML.
 *
 * Deliberately small: browser User-Agent, 10s cap, at most five redirects, and a
 * hard byte ceiling so a bloated page can't OOM a run. These are URLs a person
 * chose to read; the SSRF guard lives on the model-chosen path instead.
 */

export interface GotPage {
  /** The URL we actually ended on, after redirects. */
  finalUrl: string;
  contentType: string;
  html: string;
}

export type GetResult = ({ ok: true } & GotPage) | { ok: false; reason: string };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export const isHtml = (contentType: string) => /text\/html|application\/xhtml/i.test(contentType);

async function readCapped(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      chunks.push(value);
      if (total >= max) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Fetch a page, following redirects by hand. Never throws. */
export async function getPage(inputUrl: string): Promise<GetResult> {
  let url = inputUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
      });
    } catch (error) {
      const code = (error as { cause?: { code?: string } })?.cause?.code;
      return { ok: false, reason: code ? `network ${code}` : "network/timeout" };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: false, reason: `http ${res.status}, no location` };
      try {
        url = new URL(location, url).toString();
      } catch {
        return { ok: false, reason: "bad redirect target" };
      }
      continue;
    }

    if (!res.ok) return { ok: false, reason: `http ${res.status}` };

    const html = await readCapped(res, MAX_BYTES).catch(() => "");
    if (!html) return { ok: false, reason: "empty body" };

    return {
      ok: true,
      finalUrl: url,
      contentType: res.headers.get("content-type") ?? "",
      html,
    };
  }

  return { ok: false, reason: "redirect loop" };
}
