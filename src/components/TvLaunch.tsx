"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TvScreen } from "@/components/TvScreen";

// Der geheime Teil des Links steht hinter dem "#". Das schickt der Browser nie mit,
// daher landet er nicht in Server-Logs; wir senden ihn nur im Body an /api/tv.
// "?k=" geht als Notlösung für Fernseher, die das "#" abschneiden.
function readToken(): string | null {
  const hash = decodeURIComponent(window.location.hash.slice(1)).trim();
  if (hash) return hash;
  return new URLSearchParams(window.location.search).get("k");
}

export function TvLaunch() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function open(fresh: boolean) {
    const token = readToken();
    if (!token) {
      setMissing(true);
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ code: string }>("/api/tv", { body: { token, fresh } });
      setCode(res.code);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Beim Öffnen (auch durch Home Assistant) die laufende Runde holen oder eine neue starten
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Startaufruf, setzt State erst nach der Antwort
    open(false);
    const onHash = () => open(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (code) return <TvScreen key={code} code={code} onNew={() => open(true)} busyNew={busy} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-display text-4xl font-extrabold tracking-wide text-accent">Filmabend</p>
      {missing ? (
        <>
          <h1 className="text-4xl">Hier fehlt der Fernseher-Link</h1>
          <p className="text-lg text-muted">
            Den Link für euren Fernseher gibt es auf der Seite{" "}
            <Link href="/fernseher" className="text-accent underline underline-offset-4">
              Fernseher
            </Link>
            .
          </p>
        </>
      ) : error ? (
        <>
          <h1 className="text-4xl">Das hat nicht geklappt</h1>
          <p className="text-lg text-muted">{error}</p>
          <button className="btn-primary" onClick={() => open(false)} disabled={busy}>
            Nochmal versuchen
          </button>
        </>
      ) : (
        <p className="text-2xl text-muted">Runde wird vorbereitet …</p>
      )}
    </main>
  );
}
