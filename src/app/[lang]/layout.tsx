import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Big_Shoulders, Big_Shoulders_Inline, Figtree } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { LOCALES } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { AUTHOR, AUTHOR_URL, REPO_URL } from "@/lib/i18n/brand";
import { APP_NAME, pageLocale } from "@/lib/i18n/page";
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

// Beide Sprachen werden fertig vorgerendert. Welche jemand bekommt, entscheidet src/proxy.ts.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = MESSAGES[await pageLocale()];
  return {
    title: APP_NAME,
    description: t.meta.description,
    authors: [{ name: AUTHOR, url: AUTHOR_URL }],
    creator: AUTHOR,
  };
}

// Vercel Analytics nur, wenn die App auf Vercel läuft (dort ist VERCEL=1 gesetzt).
// Beim Self-Hosting (Docker) gibt es /_vercel/insights nicht, dann wird nichts eingebunden.
const onVercel = process.env.VERCEL === "1";

export const viewport: Viewport = { themeColor: "#2A0A14", width: "device-width", initialScale: 1 };

// suppressHydrationWarning: Browser-Erweiterungen (z.B. data-qb-installed) setzen Attribute auf <html>,
// bevor React lädt. Gilt nur für dieses eine Element, nicht für die Kinder.
export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await pageLocale();
  return (
    <html lang={lang} suppressHydrationWarning className={`${display.variable} ${marquee.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={lang}>{children}</I18nProvider>
        {/* Urheber-Hinweis auf jeder Seite. Auf dem Fernseher (/tv) liegt er unterhalb des sichtbaren Bereichs. */}
        <footer className="px-4 pt-2 pb-5 text-center text-xs text-muted">
          © 2026 {APP_NAME} · {MESSAGES[lang].common.madeBy}{" "}
          <a href={AUTHOR_URL} className="font-semibold underline-offset-2 hover:underline" target="_blank" rel="author noopener">
            {AUTHOR}
          </a>
          {" · "}
          <a href={REPO_URL} className="underline-offset-2 hover:underline" target="_blank" rel="noopener">
            GitHub
          </a>
        </footer>
        {onVercel && <Analytics />}
      </body>
    </html>
  );
}
