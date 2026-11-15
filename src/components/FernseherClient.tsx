"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ProviderPicker } from "@/components/ProviderPicker";

type Tv = { token: string; providerIds: number[]; anySource: boolean };
type Info = { crew: { name: string } | null; tv: Tv | null };

export function FernseherClient() {
  const [info, setInfo] = useState<Info | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [anySource, setAnySource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    api<Info>("/api/fernseher")
      .then((d) => {
        setOrigin(window.location.origin);
        setInfo(d);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function run(method: "PUT" | "POST" | "DELETE", body: object = {}) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ tv: Tv | null }>("/api/fernseher", { method, body });
      setInfo((i) => (i ? { ...i, tv: res.tv } : i));
      if (method === "PUT") setSaved(true);
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!info) return <p className="text-muted">{error ?? "Lade …"}</p>;
  if (!info.crew)
    return (
      <section className="card flex flex-col gap-3">
        <h2 className="text-3xl">Erst eine Runde starten</h2>
        <p className="text-muted">
          Der Fernseher gehört zu einer Crew. Auf diesem Gerät gibt es noch keine. Starte einmal eine Runde (oder melde dich
          im Konto an), danach kannst du hier den Fernseher einrichten.
        </p>
        <Link href="/" className="btn-primary text-center">
          Runde starten
        </Link>
      </section>
    );

  const link = info.tv ? `${origin}/tv#${info.tv.token}` : "";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">Crew: {info.crew.name}</p>
      <ProviderPicker
        // Neu laden, sobald gespeicherte Einstellungen da sind
        key={info.tv ? "tv" : "neu"}
        picked={picked}
        setPicked={setPicked}
        anySource={anySource}
        setAnySource={setAnySource}
        preset={info.tv ? { ids: info.tv.providerIds, other: info.tv.anySource } : undefined}
        onError={setError}
        title="Welche Dienste zählen am Fernseher?"
        hint="Gilt für Runden, die über den Fernseher-Link oder Home Assistant starten. Nichts gewählt = alle bekannten."
      />
      {error && <p className="text-sm text-no">{error}</p>}
      <button className="btn-primary" disabled={busy} onClick={() => run("PUT", { providerIds: picked, anySource })}>
        {busy ? "Speichert …" : info.tv ? (saved ? "Gespeichert ✓" : "Dienste speichern") : "Fernseher einrichten"}
      </button>

      {info.tv && (
        <section className="card flex flex-col gap-4">
          <h2 className="text-3xl">Euer Fernseher-Link</h2>
          <p className="text-sm text-muted">
            Wer diesen Link hat, kann für eure Crew eine Runde öffnen. Behandelt ihn wie einen Schlüssel und teilt ihn nicht
            öffentlich.
          </p>
          <input className="input py-2.5 text-sm" readOnly value={link} aria-label="Fernseher-Link" onFocus={(e) => e.target.select()} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? "Kopiert ✓" : "Link kopieren"}
            </button>
            <a className="btn-ghost" href={link} target="_blank" rel="noopener">
              Jetzt öffnen
            </a>
          </div>
          <details className="text-sm text-muted">
            <summary className="cursor-pointer text-text">So geht&apos;s mit Home Assistant</summary>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
              <li>Fernseher in Home Assistant einbinden (z. B. LG webOS, Android TV, Fire TV oder Samsung).</li>
              <li>Ein Skript „Starte Filmabend“ anlegen: Fernseher einschalten, kurz warten, dann diesen Link im Browser des Fernsehers öffnen.</li>
              <li>Das Skript per Sprachbefehl, Knopf oder Automation starten. Der Fernseher zeigt dann sofort den QR-Code.</li>
            </ol>
            <p className="mt-2">
              Wird der Link nochmal geöffnet, solange die Runde läuft, zeigt er dieselbe Runde. Ist sie vorbei, startet eine neue.
              Wer zuerst beitritt, leitet die Runde.
            </p>
          </details>
          <div className="flex flex-col gap-2 border-t border-line/70 pt-4">
            <button type="button" className="text-left text-sm text-muted underline underline-offset-4" disabled={busy} onClick={() => run("POST")}>
              Neuen Link erzeugen (der alte geht dann nicht mehr)
            </button>
            <button type="button" className="text-left text-sm text-no underline underline-offset-4" disabled={busy} onClick={() => run("DELETE")}>
              Fernseher-Link ausschalten
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
