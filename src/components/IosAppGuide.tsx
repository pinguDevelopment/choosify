"use client";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { APP_NAME } from "@/lib/i18n/brand";
import { ShareIcon, useStandalone } from "@/lib/app-mode";

/** Inhalt der Seite /ios-app: Schritte, Hinweis zur Anmeldung, Link an Freunde weitergeben. */
export function IosAppGuide() {
  const t = useT();
  const standalone = useStandalone();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/ios-app`;
    if (navigator.share) {
      await navigator.share({ title: APP_NAME, text: t.app.title, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Kopieren nicht erlaubt
    }
  };

  return (
    <>
      <section className="flex flex-col gap-3">
        <h1 className="text-4xl text-text">{t.app.title}</h1>
        <p className="text-muted">{t.app.intro}</p>
      </section>

      {standalone ? (
        <p className="rounded-2xl border-2 border-yes/60 bg-surface px-4 py-3.5 font-semibold text-yes">{t.app.installed}</p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl text-accent">{t.app.stepsTitle}</h2>
          <ol className="flex flex-col gap-2.5">
            {t.app.steps(<ShareIcon className="text-accent" />).map((step, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-surface px-4 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">{i + 1}</span>
                <span className="text-text">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">{t.app.otherBrowsers}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl text-accent">{t.app.loginTitle}</h2>
        <p className="text-muted">{t.app.login}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl text-accent">{t.app.shareTitle}</h2>
        <p className="text-muted">{t.app.share}</p>
        <button type="button" onClick={share} className="btn-primary">
          {copied ? t.common.linkCopied : t.app.shareButton}
        </button>
      </section>

      <p className="text-sm text-muted">
        {t.app.android}{" "}
        {/* Kein next/link: /handy-app leitet auf die APK-Datei bei GitHub weiter */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/handy-app" className="font-semibold text-accent underline-offset-2 hover:underline">
          {t.app.androidLink}
        </a>
      </p>
      <Link href="/" className="text-muted underline decoration-line underline-offset-4 hover:text-text">
        {t.common.toHome}
      </Link>
    </>
  );
}
