"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { ShareIcon, isIos, useStandalone } from "@/lib/app-mode";

const DISMISSED_KEY = "cinemood:ios-hinweis-weg";

/** Kleiner Hinweis auf der Startseite für iPhone-Besucher im Browser: Cinemood zum Home-Bildschirm hinzufügen. */
export function IosInstallHint() {
  const t = useT();
  const standalone = useStandalone();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Privater Modus: Hinweis trotzdem zeigen
    }
    // Erst nach dem Laden entscheiden: Der Server weiß nicht, welches Gerät es ist.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(!dismissed && isIos() && !/\bCinemoodApp\//.test(navigator.userAgent));
  }, []);

  if (!show || standalone) return null;

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // egal
    }
  };

  return (
    <aside className="relative rounded-2xl border-2 border-line bg-surface px-4 py-3.5 pr-11">
      <p className="font-semibold text-text">{t.app.hintTitle}</p>
      <p className="mt-1 text-sm text-muted">
        {t.app.hint(<ShareIcon className="text-accent" />)}{" "}
        <Link href="/ios-app" className="font-semibold text-accent underline-offset-2 hover:underline">
          {t.app.hintMore}
        </Link>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label={t.app.hintClose}
        className="absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full text-muted hover:text-text"
      >
        ✕
      </button>
    </aside>
  );
}
