/**
 * PWA identity and asset metadata, shared by the app and the asset generator.
 *
 * iOS has no manifest field for a launch screen. It wants one image per device
 * geometry, declared in the document head with a media query — hence a table
 * rather than a single file. Anything missing falls back to a blank screen,
 * which is the failure this exists to prevent.
 *
 * The colours are the app's own tokens, not the logo's: a splash paints the
 * `--background` surface, so it must match the dashboard. The app has a light
 * and a dark palette, so each geometry is rendered twice and selected with
 * `prefers-color-scheme`. Both values are the `--background` token from
 * `packages/ui/src/styles/tokens.css` (`0 0% 100%` and `240 4% 10%`).
 */

export const PWA = {
  name: "Curio",
  shortName: "Curio",
  description:
    "A reading app with an agent. Import everything you read, keep every mark, and search it all, online or off.",
  /** The light `--background` surface. */
  light: "#ffffff",
  /** The dark `--background` surface. Also the install chrome, which cannot switch. */
  dark: "#19191b",
} as const;

export type SplashTheme = "light" | "dark";

export type SplashDevice = {
  /** CSS width. */
  w: number;
  /** CSS height. */
  h: number;
  /** Device pixel ratio, so the file is `w * dpr` by `h * dpr`. */
  dpr: number;
};

/** Portrait devices iOS still supports. The manifest pins portrait. */
export const SPLASH_DEVICES: SplashDevice[] = [
  // iPhone SE, 8
  { w: 375, h: 667, dpr: 2 },
  // iPhone 8 Plus
  { w: 414, h: 736, dpr: 3 },
  // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  { w: 375, h: 812, dpr: 3 },
  // iPhone XR, 11
  { w: 414, h: 896, dpr: 2 },
  // iPhone XS Max, 11 Pro Max
  { w: 414, h: 896, dpr: 3 },
  // iPhone 12, 13, 14
  { w: 390, h: 844, dpr: 3 },
  // iPhone 12/13 Pro Max, 14 Plus
  { w: 428, h: 926, dpr: 3 },
  // iPhone 14 Pro, 15, 15 Pro, 16
  { w: 393, h: 852, dpr: 3 },
  // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { w: 430, h: 932, dpr: 3 },
  // iPhone 16 Pro
  { w: 402, h: 874, dpr: 3 },
  // iPhone 16 Pro Max
  { w: 440, h: 956, dpr: 3 },
  // iPad mini 6
  { w: 744, h: 1133, dpr: 2 },
  // iPad 10.2"
  { w: 810, h: 1080, dpr: 2 },
  // iPad Air 10.9"
  { w: 820, h: 1180, dpr: 2 },
  // iPad Pro 11"
  { w: 834, h: 1194, dpr: 2 },
  // iPad Pro 12.9"
  { w: 1024, h: 1366, dpr: 2 },
];

/** Output pixel size of a device's splash image. */
export function splashSize(device: SplashDevice) {
  return { width: device.w * device.dpr, height: device.h * device.dpr };
}

/** Served path. Keyed by pixel size, so devices sharing a resolution share a file. */
export function splashPath(device: SplashDevice, theme: SplashTheme) {
  const { width, height } = splashSize(device);
  return `/splash/apple-splash-${width}x${height}-${theme}.png`;
}

/** The media query iOS matches against the installed device and its theme. */
export function splashMedia(device: SplashDevice, theme: SplashTheme) {
  return `(device-width: ${device.w}px) and (device-height: ${device.h}px) and (-webkit-device-pixel-ratio: ${device.dpr}) and (prefers-color-scheme: ${theme})`;
}

/** Unique splash files to generate, across both themes. */
export function splashFiles() {
  const seen = new Map<string, { path: string; width: number; height: number; theme: SplashTheme }>();
  for (const device of SPLASH_DEVICES) {
    const { width, height } = splashSize(device);
    for (const theme of ["dark", "light"] as const) {
      const path = splashPath(device, theme);
      if (!seen.has(path)) seen.set(path, { path, width, height, theme });
    }
  }
  return [...seen.values()];
}

/** The `appleWebApp.startupImage` value, in declaration order. */
export const SPLASH_IMAGES = SPLASH_DEVICES.flatMap((device) =>
  (["dark", "light"] as const).map((theme) => ({
    url: splashPath(device, theme),
    media: splashMedia(device, theme),
  })),
);
