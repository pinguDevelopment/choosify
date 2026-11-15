import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale, resolveLocale } from "@/lib/i18n/config";

/**
 * Sprache ohne Sprachkürzel in der Adresse: Die Links (QR-Codes, Fernseher-Link, Bewertungslinks)
 * bleiben gleich. Intern wird jede Seite auf /de/... bzw. /en/... umgeschrieben, damit beide
 * Sprachen fertig vorgerendert ausgeliefert werden können.
 * Reihenfolge: gespeicherte Wahl (Cookie "lang") vor Browsersprache, sonst Englisch.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const [, first] = pathname.split("/");

  // /en/... oder /de/... direkt aufgerufen (z. B. geteilter Link): Sprache merken, ohne Kürzel weiter.
  if (isLocale(first)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(first.length + 1) || "/";
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
    return res;
  }

  const locale = resolveLocale(req.cookies.get(LOCALE_COOKIE)?.value, req.headers.get("accept-language"));
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Nicht für API, Next-Interna und Dateien (icon.svg, manifest.webmanifest, favicon.ico, …).
  // Nur echte Dateiendungen ausnehmen: Bewertungslinks enthalten Punkte (/bewerten/<crew>.<film>.<sig>).
  matcher: ["/((?!api/|_next/|_vercel/|.*\\.(?:ico|svg|png|jpe?g|webp|gif|webmanifest|txt|xml|json|js|css|map)$).*)"],
};

