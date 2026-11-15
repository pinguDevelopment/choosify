"use client";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { switchLocale, useLocale, useT } from "@/components/I18nProvider";

/** Kleine Sprachauswahl (DE | EN). Die Wahl wird gespeichert und gilt auf allen Seiten. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  return (
    <div role="group" aria-label={t.language.label} className={`inline-flex shrink-0 rounded-full border-2 border-line p-0.5 text-xs font-bold ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          title={LOCALE_NAMES[l]}
          aria-label={LOCALE_NAMES[l]}
          onClick={() => l !== locale && switchLocale(l)}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wider transition-colors ${
            l === locale ? "bg-accent text-accent-ink" : "text-muted hover:text-text"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
