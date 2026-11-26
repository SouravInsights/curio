import { existsSync } from "node:fs";
import { env } from "@curio/core/config";

/**
 * Render a page in a real browser and return its HTML after scripts have run.
 *
 * Extraction's last rung: some pages return 200 with an empty body from a plain
 * fetch because JavaScript builds the content. Imported files (EPUB, PDF,
 * newsletter HTML) never take this path.
 *
 * The browser is launched once per process and reused. puppeteer-core is
 * imported lazily so a deploy that never renders a JS page never loads it.
 */

export interface Rendered {
  html: string;
  /** `document.body.innerText` — visible text, used when extraction finds little. */
  text: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const NAV_TIMEOUT = 30_000;
const SETTLE_MS = 1_000;
const RENDER_TIMEOUT_MS = 25_000;
const LAUNCH_TIMEOUT = 20_000;

type Browser = Awaited<ReturnType<typeof import("puppeteer-core").launch>>;

const CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

function executablePath(): string {
  if (env.CHROME_PATH && existsSync(env.CHROME_PATH)) return env.CHROME_PATH;
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error("No Chrome found for rendering. Set CHROME_PATH.");
  return found;
}

let shared: Promise<Browser> | null = null;

async function browser(): Promise<Browser> {
  if (!shared) {
    const puppeteer = (await import("puppeteer-core")).default;
    shared = puppeteer
      .launch({
        executablePath: executablePath(),
        headless: true,
        timeout: LAUNCH_TIMEOUT,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      })
      .catch((error: unknown) => {
        shared = null;
        throw error;
      });
  }
  return shared;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function renderHtml(url: string): Promise<Rendered> {
  const instance = await browser();
  let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
  try {
    page = await instance.newPage();
    const load = (async () => {
      await page!.setUserAgent(UA);
      await page!.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await page!.evaluate(async (ms: number) => {
        await document.fonts.ready;
        await new Promise((resolve) => setTimeout(resolve, ms));
      }, SETTLE_MS);
      const html = await page!.content();
      const text = await page!.evaluate(() => document.body?.innerText ?? "");
      return { html, text };
    })();
    return await withTimeout(load, RENDER_TIMEOUT_MS, "render timed out");
  } catch (error) {
    if (
      error instanceof Error &&
      /Target closed|Session closed|Connection closed|Protocol error/i.test(error.message)
    ) {
      shared = null;
    }
    throw error;
  } finally {
    await Promise.race([
      page?.close().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
}

/** Close the shared browser. Call once when a batch run finishes. */
export async function closeRenderer(): Promise<void> {
  if (!shared) return;
  const instance = await shared.catch(() => null);
  shared = null;
  await instance?.close().catch(() => undefined);
}
