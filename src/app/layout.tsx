import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Big_Shoulders_Inline, Figtree } from "next/font/google";
import "./globals.css";

// Big Shoulders: schmale Groteske nach Chicagoer Kino- und Straßenschildern.
// adjustFontFallback aus: Next kennt für diese Schrift keine Metriken und warnt sonst bei jedem Request.
const display = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "800"],
  adjustFontFallback: false,
  fallback: ["Impact", "Arial Narrow", "sans-serif"],
});
// Inline-Schnitt nur für die Leuchtreklame (Logo und Gewinner).
const marquee = Big_Shoulders_Inline({
  variable: "--font-marquee",
  subsets: ["latin"],
  weight: ["800"],
  adjustFontFallback: false,
  fallback: ["Impact", "Arial Narrow", "sans-serif"],
});
const body = Figtree({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Choosify",
  description: "Gemeinsam schnell einen Film finden",
};

export const viewport: Viewport = { themeColor: "#2A0A14", width: "device-width", initialScale: 1 };

// suppressHydrationWarning: Browser-Erweiterungen (z.B. data-qb-installed) setzen Attribute auf <html>,
// bevor React lädt. Gilt nur für dieses eine Element, nicht für die Kinder.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" suppressHydrationWarning className={`${display.variable} ${marquee.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
