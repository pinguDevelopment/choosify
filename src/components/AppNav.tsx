"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useT } from "@/components/I18nProvider";
import { useStandalone } from "@/lib/app-mode";

/** Symbole wie in der Android-App (Material Icons), damit beide gleich aussehen. */
const ICONS = {
  lobby: "M10,20v-6h4v6h5v-8h3L12,3 2,12h3v8z",
  watchlist: "M17,3H7c-1.1,0 -1.99,0.9 -1.99,2L5,21l7,-3 7,3V5c0,-1.1 -0.9,-2 -2,-2z",
  train:
    "M19,9l1.25,-2.75L23,5l-2.75,-1.25L19,1l-1.25,2.75L15,5l2.75,1.25L19,9zM11.5,9.5L9,4 6.5,9.5 1,12l5.5,2.5L9,20l2.5,-5.5L17,12l-5.5,-2.5zM19,15l-1.25,2.75L15,19l2.75,1.25L19,23l1.25,-2.75L23,19l-2.75,-1.25L19,15z",
  account: "M12,12c2.21,0 4,-1.79 4,-4s-1.79,-4 -4,-4 -4,1.79 -4,4 1.79,4 4,4zM12,14c-2.67,0 -8,1.34 -8,4v2h16v-2c0,-2.66 -5.33,-4 -8,-4z",
} as const;

type Section = keyof typeof ICONS;
const HREF: Record<Section, string> = { lobby: "/", watchlist: "/watchlist", train: "/trainieren", account: "/konto" };

/** Welcher Bereich zu einer Adresse gehört (Runden zählen zur Lobby), wie in der Android-App. */
function sectionOf(path: string): Section {
  const p = path.replace(/^\/(de|en)(?=\/|$)/, "") || "/";
  if (/^\/(watchlist|abspann|bewerten|einladung)(\/|$)/.test(p)) return "watchlist";
  if (/^\/trainieren(\/|$)/.test(p)) return "train";
  if (/^\/konto(\/|$)/.test(p)) return "account";
  return "lobby";
}

/**
 * Navigationsleiste unten, nur wenn Cinemood als App vom Home-Bildschirm läuft (iPhone, Android-PWA).
 * Im normalen Browser bleibt alles wie gehabt. Setzt die Klasse "app" auf <html>, damit globals.css
 * Platz für Statusleiste und Leiste lässt.
 */
export function AppNav({ accounts }: { accounts: boolean }) {
  const t = useT();
  const standalone = useStandalone();
  const pathname = usePathname() ?? "/";
  const hidden = !standalone || /^\/((de|en)\/)?tv(\/|$)/.test(pathname);

  useEffect(() => {
    document.documentElement.classList.toggle("app", !hidden);
  }, [hidden]);

  if (hidden) return null;
  const sections: Section[] = accounts ? ["lobby", "watchlist", "train", "account"] : ["lobby", "watchlist"];
  const current = sectionOf(pathname);

  return (
    <nav aria-label={t.app.navLabel} className="app-nav fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-md">
        {sections.map((s) => {
          const active = s === current;
          return (
            <li key={s} className="flex-1">
              <Link
                href={HREF[s]}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  // Schon dort: nach oben scrollen statt neu laden (wie in anderen Apps)
                  if (active && sectionOf(window.location.pathname) === s && window.location.pathname === HREF[s]) {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold tracking-wide transition-colors ${
                  active ? "text-accent" : "text-muted active:text-text"
                }`}
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6" fill="currentColor">
                  <path d={ICONS[s]} />
                </svg>
                {t.app[s]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
