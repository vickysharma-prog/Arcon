import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Funnel_Display, Funnel_Sans, Martian_Mono } from "next/font/google";
import "./globals.css";
import { CookieNotice } from "@/components/CookieNotice";
import { Guide } from "@/components/demo/Guide";
import { TourBar } from "@/components/demo/TourBar";
import { Intro } from "@/components/landing/Intro";
import { INSTALL_SCRIPT, RELOAD_SCRIPT, THEME_SCRIPT } from "@/components/theme-script";

// Funnel for headings and text, Martian Mono for labels and numbers (Vicky, 21 Oct).
const sans = Funnel_Sans({ variable: "--font-body", subsets: ["latin"] });
const display = Funnel_Display({ variable: "--font-display", subsets: ["latin"] });
const mono = Martian_Mono({ variable: "--font-code", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Arcon",
  description: "An AI architect that designs any space around the taste of the people who use it.",
  applicationName: "Arcon",
  // Installed on an iPhone's home screen: its icon, its name, and a full-screen app.
  appleWebApp: { capable: true, title: "Arcon", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: RELOAD_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* the opening, each time Arcon is opened (once a session), whichever page it opens on */}
        <Intro />
        {children}
        <CookieNotice />
        {/* reads the URL, so it streams in after the page */}
        <Suspense fallback={null}>
          <TourBar />
          <Guide />
        </Suspense>
      </body>
    </html>
  );
}
