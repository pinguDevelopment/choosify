"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RoomState } from "./types";

function useJoinQr(code: string) {
  const [qr, setQr] = useState<{ url: string; img: string } | null>(null);
  useEffect(() => {
    const url = `${window.location.origin}/r/${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#0d0b10", light: "#f3eee6" } }).then((img) =>
      setQr({ url, img }),
    );
  }, [code]);
  return qr;
}

export function Lobby({ state, onChange, compact }: { state: RoomState; onChange: () => void; compact?: boolean }) {
  const qr = useJoinQr(state.code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isHost = state.me?.isHost;
  const ready = state.participants.filter((p) => p.genresDone).length;

  return (
    <>
      <section className="card flex flex-col items-center gap-3 text-center">
        <h2 className="text-lg font-semibold">Scannen und mitmachen</h2>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL, kein Optimieren nötig
          <img src={qr.img} alt={`QR-Code zum Beitreten: ${qr.url}`} className="w-56 rounded-xl" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-xl bg-surface-2" />
        )}
        <button
          type="button"
          className="text-sm text-muted underline-offset-4 hover:underline"
          onClick={async () => {
            if (!qr) return;
            if (navigator.share) await navigator.share({ title: "Film Aussucher", url: qr.url }).catch(() => {});
            else {
              await navigator.clipboard.writeText(qr.url);
              setCopied(true);
            }
          }}
        >
          {copied ? "Link kopiert ✓" : "Link teilen"}
        </button>
      </section>

      {!compact && (
        <section className="card flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Dabei ({state.participants.length})</h2>
            <span className="text-sm text-muted">{ready} bereit</span>
          </div>
          <ul className="flex flex-col gap-2">
            {state.participants.map((p) => (
              <li key={p.name} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5">
                <span>
                  {p.name}
                  {p.isHost && <span className="ml-2 text-xs text-accent">Host</span>}
                </span>
                <span className={p.genresDone ? "text-yes" : "text-muted"}>{p.genresDone ? "bereit" : "wählt …"}</span>
              </li>
            ))}
          </ul>
          {isHost ? (
            <>
              {error && <p className="text-sm text-no">{error}</p>}
              <button
                className="btn-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await api(`/api/rooms/${state.code}/start`, { body: {} });
                    onChange();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Suche Filme …" : "Swipen starten"}
              </button>
              {ready < state.participants.length && (
                <p className="text-center text-xs text-muted">Du kannst auch starten, wenn noch nicht alle bereit sind.</p>
              )}
            </>
          ) : (
            <p className="text-center text-sm text-muted">Warte, bis der Host startet …</p>
          )}
        </section>
      )}
    </>
  );
}
