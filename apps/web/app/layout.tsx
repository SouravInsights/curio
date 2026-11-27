import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { PWA, SPLASH_IMAGES } from "@/lib/pwa";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

/**
 * `viewport-fit=cover` lets the app paint under the notch; `interactive-widget`
 * resizes the layout when the keyboard opens instead of covering the field.
 * `themeColor` is per scheme, so the status bar follows the reader's theme; the
 * manifest's single colour cannot, which is why it takes the dark default.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PWA.light },
    { media: "(prefers-color-scheme: dark)", color: PWA.dark },
  ],
};

export const metadata: Metadata = {
  // Makes file-based icons and social images absolute, which crawlers require.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Curio", template: "%s · Curio" },
  description: PWA.description,
  applicationName: PWA.name,
  // Installed on iOS the app runs full-screen from the home screen. iOS has no
  // manifest field for a launch screen: it wants one image per device geometry
  // and theme, matched by media query. The table and the files live in
  // lib/pwa.ts and public/splash.
  appleWebApp: {
    capable: true,
    title: PWA.shortName,
    statusBarStyle: "default",
    startupImage: SPLASH_IMAGES,
  },
  formatDetection: { telephone: false },
};

/**
 * The theme is set before paint, from localStorage, so there is no flash of the
 * wrong surface. Dark is the default: this is a reading app and the reference is
 * a dark reader.
 */
const themeScript = `try{var t=localStorage.getItem("curio-theme");var d=t?t==="dark":true;document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
