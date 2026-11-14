"use client";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RoomState } from "./types";

function useJoinQr(code: string) {
  const [qr, setQr] = useState<{ url: string; img: string } | null>(null);
  useEffect(() => {
    const url = `${window.location.origin}/r/${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#2a0a14", light: "#f6e7da" } }).then((img) =>
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
      {compact ? (
        // Beim Genre-Wählen nur eine kleine Einladung, damit die Genres oben sichtbar bleiben
        <section className="card flex items-center gap-4 p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, kein Optimieren nötig
            <img src={qr.img} alt={`QR-Code zum Beitreten: ${qr.url}`} className="h-24 w-24 rounded-lg" />
          ) : (
            <div className="h-24 w-24 animate-pulse rounded-lg bg-surface-2" />
          )}
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <p className="font-display text-xl font-extrabold leading-tight">Freunde reinholen</p>
            <p className="text-sm text-muted">{state.participants.length} im Saal · QR scannen lassen</p>
            <button type="button" className="text-sm text-accent underline decoration-accent/40 underline-offset-4" onClick={async () => {
            if (!qr) return;
            if (navigator.share) await navigator.share({ title: "Choosify", url: qr.url }).catch(() => {});
            else {
              await navigator.clipboard.writeText(qr.url);
              setCopied(true);
            }
          }}>
              {copied ? "Link kopiert" : "Link teilen"}
            </button>
          </div>
        </section>
      ) : (
      <section className="card flex flex-col items-center gap-4 text-center">
        <h2 className="text-3xl">Alle mal scannen</h2>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL, kein Optimieren nötig
          <img src={qr.img} alt={`QR-Code zum Beitreten: ${qr.url}`} className="w-56 rounded-xl" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-xl bg-surface-2" />
        )}
        <button
          type="button"
          className="text-muted underline decoration-line underline-offset-4 hover:text-text"
          onClick={async () => {
            if (!qr) return;
            if (navigator.share) await navigator.share({ title: "Choosify", url: qr.url }).catch(() => {});
            else {
              await navigator.clipboard.writeText(qr.url);
              setCopied(true);
            }
          }}
        >
          {copied ? "Link kopiert" : "Link teilen"}
        </button>
      </section>
      )}

      {!compact && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl">{state.participants.length} im Saal</h2>
            <span className="text-muted">{ready} bereit</span>
          </div>
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
            {state.participants.map((p) => (
              <motion.li
                layout
                key={p.name}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="flex items-center gap-3 border-b border-line/70 py-2.5 text-lg last:border-0"
              >
                <span
                  aria-hidden
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold ${
                    p.genresDone ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"
                  }`}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {p.name}
                  {p.isHost && <span className="ml-2 rounded-full border border-accent/50 px-2 py-0.5 align-middle text-xs text-accent">Host</span>}
                </span>
                <motion.span
                  key={p.genresDone ? "ready" : "wait"}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className={p.genresDone ? "text-yes" : "text-muted"}
                >
                  {p.genresDone ? "bereit" : "wählt noch"}
                </motion.span>
              </motion.li>
            ))}
            </AnimatePresence>
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
                {busy ? "Filme werden gesucht …" : "Swipen starten"}
              </button>
              {ready < state.participants.length && (
                <p className="text-center text-sm text-muted">Du kannst auch starten, wenn noch nicht alle bereit sind.</p>
              )}
            </>
          ) : (
            <p className="text-center text-muted">Warte, bis der Host startet …</p>
          )}
        </section>
      )}
    </>
  );
}
