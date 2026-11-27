import type { MetadataRoute } from "next";

import { PWA } from "@/lib/pwa";

/**
 * Web app manifest. Everything here is what turns the site into something a
 * phone will offer to install: a name, a start URL, a display mode, and icons
 * at the two sizes Chrome and Android require.
 *
 * `background_color` and `theme_color` are the app's dark `--background`, so
 * the install chrome and the launch surface look like the app. They cannot
 * switch with the system the way the in-app `themeColor` does — a manifest is
 * one static document — so they take the default (dark) theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PWA.name,
    short_name: PWA.shortName,
    description: PWA.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: PWA.dark,
    theme_color: PWA.dark,
    categories: ["news", "productivity", "books"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The mark sits inside the maskable safe zone on a full-bleed field, so
      // an Android launcher can crop it to any shape without clipping.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
