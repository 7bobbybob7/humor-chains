import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "./nav";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Humor Project · Chains",
  description:
    "Build, reorder and run the prompt chains that write the captions.",
};

/**
 * Applies the stored theme before first paint.
 *
 * Without this the server's markup is always light, so a visitor who chose
 * dark sees a white flash on every navigation. It has to be inline and
 * synchronous in <head> for that reason -- a component effect runs too late.
 * Absent or unparseable storage falls through to no attribute at all, which is
 * "system", the correct default.
 */
const THEME_INIT = `try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The script above mutates <html> before React hydrates, which is
      // exactly the kind of difference this silences.
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-paper text-ink"
      >
        <Nav />
        {children}
      </body>
    </html>
  );
}
