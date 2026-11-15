// Sprachen der Oberfläche. Reine Logik ohne Server- oder Browser-Abhängigkeiten.

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Für alle, deren Browser weder Deutsch noch Englisch bevorzugt. */
export const FALLBACK_LOCALE: Locale = "en";

/** Cookie mit der gewählten Sprache (ein Jahr gültig, kein Geheimnis). */
export const LOCALE_COOKIE = "lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Name jeder Sprache in ihrer eigenen Sprache (für die Sprachauswahl). */
export const LOCALE_NAMES: Record<Locale, string> = { de: "Deutsch", en: "English" };

/** Sprachcode für TMDB-Abrufe. */
export const TMDB_LANGUAGE: Record<Locale, string> = { de: "de-DE", en: "en-US" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * Sprache aus dem Accept-Language-Header des Browsers, z. B. "de-AT,de;q=0.9,en;q=0.8" -> "de".
 * Die erste unterstützte Sprache nach Gewichtung gewinnt, sonst Englisch.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const wanted = (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...rest] = part.trim().split(";");
      const q = rest.map((r) => r.trim()).find((r) => r.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((w) => w.lang && w.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  return wanted.map((w) => w.lang).find(isLocale) ?? FALLBACK_LOCALE;
}

/** Gespeicherte Wahl (Cookie) vor Browsersprache. */
export function resolveLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  return isLocale(cookie) ? cookie : localeFromAcceptLanguage(acceptLanguage);
}
