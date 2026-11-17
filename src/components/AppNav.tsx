"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

/** Mulde: Radius unter der Bubble (Bubble 28 px + 6 px Luft) und Radius der abgerundeten Kanten. */
const CRADLE = 34;
const FILLET = 12;

/** Umriss der Leiste: oben gerade, unter jeder Bubble eine runde Mulde mit abgerundeten Kanten. */
function barPath(width: number, count: number, height: number): string {
  const d = Math.sqrt((CRADLE + FILLET) ** 2 - FILLET ** 2); // Abstand Mulden-Mitte bis Kantenbeginn
  const k = CRADLE / (CRADLE + FILLET); // Berührpunkt Kante/Mulde
  const tx = d * k;
  const ty = FILLET * k;
  let p = "M-1,0";
  for (let i = 0; i < count; i++) {
    const c = ((i + 0.5) * width) / count;
    p += ` L${c - d},0 A${FILLET},${FILLET} 0 0 1 ${c - tx},${ty}`;
    p += ` A${CRADLE},${CRADLE} 0 0 0 ${c + tx},${ty}`;
    p += ` A${FILLET},${FILLET} 0 0 1 ${c + d},0`;
  }
  return `${p} L${width + 1},0 L${width + 1},${height} L-1,${height} Z`;
}

/** Hintergrund der Leiste als SVG, passt sich der Bildschirmbreite an. */
function BarShape({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden className="app-nav-edge">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="block overflow-visible">
          {/* Mulden zeigen den Seitenhintergrund, damit kein Inhalt durchscheint */}
          <rect x="0" y="0" width={size.w} height={size.h} fill="var(--velvet)" />
          <path d={barPath(size.w, count, size.h + 2)} fill="var(--curtain)" stroke="rgb(122 42 60 / 0.9)" strokeWidth="1" />
        </svg>
      )}
    </div>
  );
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
    <nav
      aria-label={t.app.navLabel}
      className="app-nav fixed inset-x-0 bottom-0 z-40"
    >
      {/* Die Leiste liegt unter den Bubbles: oben gerade, unter jeder Bubble eine runde Mulde */}
      <BarShape count={sections.length} />
      <ul className="relative flex">
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
                className="group relative flex flex-col items-center gap-2.5 text-[0.7rem] font-semibold tracking-wide"
              >
                {/* Runde Bubble je Eintrag, die aktive leuchtet in Popcorn-Gelb */}
                <span
                  className={`app-nav-bubble relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                    active
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-2 text-muted group-active:scale-95 group-active:text-text"
                  }`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6" fill="currentColor">
                    <path d={ICONS[s]} />
                  </svg>
                </span>
                <span className={active ? "text-accent" : "text-muted"}>{t.app[s]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
