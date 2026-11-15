"use client";
import { createContext, useContext } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/lib/i18n/config";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";

const I18n = createContext<{ locale: Locale; t: Messages }>({ locale: "de", t: MESSAGES.de });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18n.Provider value={{ locale, t: MESSAGES[locale] }}>{children}</I18n.Provider>;
}

/** Texte in der aktuellen Sprache. */
export const useT = () => useContext(I18n).t;
export const useLocale = () => useContext(I18n).locale;

/** Sprache merken und die Seite in der neuen Sprache neu laden. */
export function switchLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  window.location.reload();
}
