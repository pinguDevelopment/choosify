import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { isLocale, type Locale } from "./config";
import { MESSAGES } from "./messages";
import { APP_NAME } from "./brand";

export { APP_NAME };

/**
 * Sprache der Seite aus dem (intern umgeschriebenen) Pfad /de/... bzw. /en/...
 * Über next/root-params, damit Seiten mit dynamischem Code (/r/[code]) trotzdem vorgerendert werden.
 */
export async function pageLocale(): Promise<Locale> {
  const l = await lang();
  if (!isLocale(l)) notFound();
  return l;
}

/** Seitentitel wie "Abspann – Cinemood" in der Sprache der Seite. */
export async function pageTitle(key: keyof (typeof MESSAGES)["de"]["meta"]) {
  const t = MESSAGES[await pageLocale()];
  return `${t.meta[key]} – ${APP_NAME}`;
}
