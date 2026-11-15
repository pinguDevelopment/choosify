"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/components/I18nProvider";

// Host verbindet den Fernseher: Code, den der Fernseher unter /tv zeigt, hier eintippen.
// Danach zeigt der Fernseher von selbst den QR-Code dieser Runde.

const ALPHABET = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const clean = (v: string) => v.toUpperCase().replace(/[\s-]/g, "");

export function TvConnect({ code, small }: { code: string; small?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      className={`${small ? "text-sm" : ""} text-muted underline decoration-line underline-offset-4 hover:text-text`}
    >
      {done ? t.lobby.tvConnected : t.lobby.showOnTv}
    </button>
  );
  if (!open) return toggle;

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    const c = clean(value);
    if (!ALPHABET.test(c)) {
      setError(t.lobby.tvCodeShape);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/rooms/${code}/tv`, { body: { code: c } });
      setDone(true);
      setValue("");
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Erst nach dem Aufklappen sichtbar, deshalb hier schon im Browser
  const tvUrl = `${window.location.host}/tv`;
  return (
    <div className="flex w-full flex-col items-center gap-2">
      {toggle}
      <form onSubmit={connect} className="card flex w-full flex-col gap-3 p-4 text-left">
        <p className="text-sm text-muted">{t.lobby.tvHint(<span className="font-semibold text-text">{tvUrl}</span>)}</p>
        <div className="flex gap-2">
          <input
            className="input min-w-0 flex-1 text-center font-display text-2xl font-extrabold uppercase tracking-[0.2em]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="K7Q 2XH"
            maxLength={9}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label={t.lobby.tvCodeLabel}
          />
          <button className="btn-primary shrink-0" disabled={busy}>
            {busy ? t.lobby.tvConnecting : t.lobby.tvConnect}
          </button>
        </div>
        {error && <p className="text-sm text-no">{error}</p>}
        <a
          href={`/r/${code}/tv`}
          target="_blank"
          rel="noopener"
          className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-text"
        >
          {t.lobby.tvDirect}
        </a>
      </form>
    </div>
  );
}
