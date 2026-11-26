import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

/**
 * `viewport-fit=cover` lets the app paint under the notch; `interactive-widget`
 * resizes the layout when the keyboard opens instead of covering the field.
 * `themeColor` is per scheme, or the status bar is white in dark mode.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#19191b" },
  ],
};

export const metadata: Metadata = {
  title: "Curio",
  description: "A reading app with an agent, and a harness your other agents can use.",
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
