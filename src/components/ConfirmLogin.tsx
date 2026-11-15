"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { api } from "@/lib/api";
import { loadLocalFavorites } from "@/lib/favorites";
import { useT } from "@/components/I18nProvider";

/** Seite hinter dem Magic-Link. Anmelden erst per Knopf, damit Link-Scanner den Link nicht verbrauchen. */
export function ConfirmLogin({ tokenHash }: { tokenHash: string | null }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Next.js (Cache Components) versteckt Seiten beim Navigieren nur (React Activity) und
  // behält ihren State. Ohne Reset stünde der Knopf nach "Zurück zur Startseite" noch auf
  // "wird erstellt …" und ließe sich nicht mehr drücken.
  useLayoutEffect(() => () => setBusy(false), []);

  // Token aus der Adresszeile entfernen (Verlauf, geteilte Bildschirme).
  useEffect(() => {
    if (tokenHash) window.history.replaceState(null, "", "/konto/bestaetigen");
  }, [tokenHash]);

  if (!tokenHash) {
    return (
      <div className="card">
        <h1 className="text-3xl">{t.confirm.incompleteTitle}</h1>
        <p className="mt-2 text-muted">{t.confirm.incompleteText}</p>
        <Link href="/konto" className="btn-primary mt-4">
          {t.confirm.toLogin}
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <h1 className="text-3xl">{t.confirm.title}</h1>
      <p className="text-muted">{t.confirm.text}</p>
      {error && <p className="text-sm text-no">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/api/auth/bestaetigen", { body: { tokenHash, favorites: loadLocalFavorites() } });
            router.replace("/konto");
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? t.confirm.busy : t.confirm.button}
      </button>
      {error && (
        <Link href="/konto" className="text-center text-sm text-muted underline underline-offset-4">
          {t.confirm.newLink}
        </Link>
      )}
    </div>
  );
}
