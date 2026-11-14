"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { loadLocalFavorites } from "@/lib/favorites";

/** Seite hinter dem Magic-Link. Anmelden erst per Knopf, damit Link-Scanner den Link nicht verbrauchen. */
export function ConfirmLogin({ tokenHash }: { tokenHash: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token aus der Adresszeile entfernen (Verlauf, geteilte Bildschirme).
  useEffect(() => {
    if (tokenHash) window.history.replaceState(null, "", "/konto/bestaetigen");
  }, [tokenHash]);

  if (!tokenHash) {
    return (
      <div className="card">
        <h1 className="text-3xl">Link unvollständig</h1>
        <p className="mt-2 text-muted">Öffne den Link aus der Mail nochmal komplett oder tipp den Code aus der Mail ein.</p>
        <Link href="/konto" className="btn-primary mt-4">
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <h1 className="text-3xl">Fast geschafft</h1>
      <p className="text-muted">Tipp auf den Knopf, um dich auf diesem Gerät anzumelden.</p>
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
        {busy ? "Melde an …" : "Jetzt anmelden"}
      </button>
      {error && (
        <Link href="/konto" className="text-center text-sm text-muted underline underline-offset-4">
          Neuen Link anfordern
        </Link>
      )}
    </div>
  );
}
