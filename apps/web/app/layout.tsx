import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
