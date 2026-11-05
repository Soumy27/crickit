import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  Noto_Sans_Devanagari,
} from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/use-language";
import { LanguagePicker } from "@/components/language/LanguagePicker";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

/*
 * Neither display nor text face carries Devanagari, and half of what this app
 * shows is Devanagari — the balls as they were called. Without this the
 * browser falls back to whatever the device happens to have, which is a
 * different fallback on every phone and reads as an accident on a product
 * whose whole point is Indian languages.
 */
const deva = Noto_Sans_Devanagari({
  variable: "--font-deva",
  subsets: ["devanagari", "latin"],
  // No weight list: it is a variable font with a width axis as well, and
  // pinning weights makes the loader fail to fetch it at all.
  display: "swap",
});

const text = Hanken_Grotesk({
  variable: "--font-text",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Crickit — you call the match, we keep the book",
    template: "%s · Crickit",
  },
  description:
    "Score local cricket by voice. Call the ball in Hindi, Marathi or English " +
    "and Crickit writes the scorecard, calls the commentary out loud, and keeps " +
    "a career record for every player.",
  applicationName: "Crickit",
  keywords: [
    "cricket scoring",
    "voice scoring",
    "local cricket",
    "gully cricket",
    "Hindi commentary",
    "Marathi commentary",
  ],
  openGraph: {
    title: "Crickit — you call the match, we keep the book",
    description:
      "Voice scoring for local cricket, in ten Indian languages. Say what " +
      "happened; the scorecard, the commentary and the career records write " +
      "themselves.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f2bbd" },
    { media: "(prefers-color-scheme: dark)", color: "#14103f" },
  ],
  // The scorer holds this at a ground; a pinch-zoom mid-over loses a ball.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${text.variable} ${deva.variable}`}>
        <LanguageProvider>
          <LanguagePicker />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
