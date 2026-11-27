import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { PWA, splashFiles } from "../src/lib/pwa";

/**
 * Renders every installed-app asset from the one brand mark.
 *
 *   bun run pwa:assets
 *
 * The source is `app/icon.svg` — the mascot, transparent, extracted from the
 * React drawing. Vector in, so every size is crisp and the logo can never drift
 * from the app. The mark is composited onto the app's own `--background`
 * surface for launcher tiles and splash screens, so an installed Curio looks
 * like the app, not like a pasted logo.
 */

const SOURCE = "app/icon.svg";

/** Share of a launcher tile the mark occupies, leaving a launcher-safe margin. */
const ICON_INSET = 0.74;
/** A maskable crop is the harshest, so the mark sits further in. */
const MASKABLE_INSET = 0.58;
/** Share of a splash screen's short side the mark occupies. */
const SPLASH_INSET = 0.32;

/** The mark, transparent, drawn to fit a `size` box. */
async function mark(source: Buffer, size: number): Promise<Buffer> {
  return sharp(source, { density: 600 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** The mark centred on a full-bleed surface. */
async function surface(source: Buffer, size: number, inset: number, background: string) {
  const placed = await mark(source, Math.round(size * inset));
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: placed, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const svg = await readFile(SOURCE);

  // App icons: the manifest, the tab, iOS. The dark surface is the default
  // theme; launcher icons do not switch with the system.
  await sharp(await mark(svg, 512)).toFile("public/curio-logo.png");
  await sharp(await surface(svg, 192, ICON_INSET, PWA.dark)).toFile("public/icon-192.png");
  await sharp(await surface(svg, 512, ICON_INSET, PWA.dark)).toFile("public/icon-512.png");
  await sharp(await surface(svg, 512, MASKABLE_INSET, PWA.dark)).toFile(
    "public/icon-maskable-512.png",
  );
  // Next serves `app/icon.png` as the favicon and `app/apple-icon.png` as the
  // iOS home-screen icon; `app/icon.svg` is the vector favicon.
  await sharp(await surface(svg, 256, ICON_INSET, PWA.dark)).toFile("app/icon.png");
  await sharp(await surface(svg, 180, ICON_INSET, PWA.dark)).toFile("app/apple-icon.png");
  console.log("logo + app icons (192, 512, maskable 512, favicon, apple 180)");

  // Splash screens: the mark centred on the app surface, per geometry and per
  // theme, so an installed app launches into the surface the reader chose.
  await mkdir(path.resolve("public/splash"), { recursive: true });
  for (const file of splashFiles()) {
    const background = file.theme === "dark" ? PWA.dark : PWA.light;
    const size = Math.min(file.width, file.height);
    const placed = await mark(svg, Math.round(size * SPLASH_INSET));
    await sharp({
      create: { width: file.width, height: file.height, channels: 4, background },
    })
      .composite([{ input: placed, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(path.resolve(`public${file.path}`));
  }
  console.log(`splash (${splashFiles().length} files: 16 geometries x 2 themes)`);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
