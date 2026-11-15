// Kleiner Client-Helfer für die eigene API.
import { isLocale, type Locale } from "./i18n/config";
import { translateError } from "./i18n/errors";

/** Sprache der Seite (steht im lang-Attribut von <html>). */
const pageLocale = (): Locale => {
  const l = typeof document !== "undefined" ? document.documentElement.lang : "";
  return isLocale(l) ? l : "de";
};

export async function api<T = unknown>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const locale = pageLocale();
    const msg = (data as { error?: string }).error;
    throw new Error(msg ? translateError(msg, locale) : locale === "en" ? `Error ${res.status}` : `Fehler ${res.status}`);
  }
  return data as T;
}

export type Genre = { id: number; name: string };
export type Provider = { id: number; name: string; logoPath: string | null; featured: boolean };

export type AccountInfo = {
  email: string;
  favorites: { ids: number[]; other: boolean };
  crews: { id: string; name: string; active: boolean }[];
  deviceCrew: { name: string } | null;
};
