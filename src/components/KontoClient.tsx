"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type AccountInfo } from "@/lib/api";
import { loadLocalFavorites, saveLocalFavorites } from "@/lib/favorites";

export function KontoClient() {
  const [account, setAccount] = useState<AccountInfo | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ account: AccountInfo | null }>("/api/konto")
      .then((d) => {
        setAccount(d.account);
        if (d.account) saveLocalFavorites(d.account.favorites);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (account === undefined) return <p className="text-muted">{error ?? "Lade …"}</p>;
  if (account === null) return <LoginForm onDone={load} />;
  return <AccountView account={account} reload={load} />;
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/mail", { body: { email } });
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/bestaetigen", { body: { email: sentTo, code, favorites: loadLocalFavorites() } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!sentTo) {
    return (
      <form className="card flex flex-col gap-3" onSubmit={send}>
        <h2 className="text-3xl">Anmelden</h2>
        <p className="text-muted">Ohne Passwort: Wir schicken dir einen Link und einen Code per Mail.</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted">E-Mail-Adresse</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            maxLength={254}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@beispiel.de"
            required
          />
        </label>
        {error && <p className="text-sm text-no">{error}</p>}
        <button className="btn-primary" disabled={busy || !email.includes("@")}>
          {busy ? "Schicke Mail …" : "Anmelde-Link schicken"}
        </button>
      </form>
    );
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={verify}>
      <h2 className="text-3xl">Schau in dein Postfach</h2>
      <p className="text-muted">
        Wir haben eine Mail an <span className="text-text">{sentTo}</span> geschickt. Tipp auf den Link oder gib hier den Code
        aus der Mail ein. Der Code ist praktisch, wenn die Mail auf einem anderen Gerät ankommt.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted">Code aus der Mail</span>
        <input
          className="input font-display text-2xl font-extrabold tracking-[0.3em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          maxLength={10}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
        />
      </label>
      {error && <p className="text-sm text-no">{error}</p>}
      <button className="btn-primary" disabled={busy || code.length < 6}>
        {busy ? "Prüfe …" : "Anmelden"}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-muted underline underline-offset-4" onClick={() => setSentTo(null)}>
          Andere Adresse
        </button>
        <button type="button" className="text-muted underline underline-offset-4" disabled={busy} onClick={() => send()}>
          Nochmal schicken
        </button>
      </div>
      <p className="text-sm text-muted">Keine Mail da? Schau auch im Spam-Ordner nach.</p>
    </form>
  );
}

function AccountView({ account, reload }: { account: AccountInfo; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, after: () => void = reload) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <section className="card flex flex-col gap-1">
        <span className="text-sm text-muted">Angemeldet als</span>
        <span className="truncate text-lg font-semibold">{account.email}</span>
      </section>

      {account.deviceCrew && (
        <section className="card flex flex-col gap-3 border-accent">
          <h2 className="text-2xl">Crew von diesem Gerät übernehmen?</h2>
          <p className="text-muted">
            Auf diesem Gerät gibt es die Crew <span className="text-text">„{account.deviceCrew.name}“</span>. Übernimm sie in
            dein Konto, dann sind sie und ihr Abspann auf all deinen Geräten da.
          </p>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => run(() => api("/api/konto", { method: "PATCH", body: { adoptDeviceCrew: true } }))}
          >
            Ins Konto übernehmen
          </button>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">Deine Crews</h2>
        {account.crews.length === 0 ? (
          <p className="text-muted">
            Noch keine. Deine Crew entsteht, sobald du die erste Runde startest.{" "}
            <Link href="/" className="underline underline-offset-4">
              Runde starten
            </Link>
          </p>
        ) : (
          <>
            {account.crews.length > 1 && (
              <p className="text-sm text-muted">Neue Runden und der Abspann nutzen die ausgewählte Crew.</p>
            )}
            <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Aktive Crew">
              {account.crews.map((c) => (
                <li key={c.id}>
                  <button
                    role="radio"
                    aria-checked={c.active}
                    disabled={busy}
                    onClick={() => !c.active && run(() => api("/api/konto", { method: "PATCH", body: { crewId: c.id } }))}
                    className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-left ${
                      c.active ? "border-accent bg-surface" : "border-line hover:border-muted"
                    }`}
                  >
                    <span className="truncate font-semibold">{c.name}</span>
                    {c.active && <span className="text-sm text-accent">aktiv</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {error && <p className="text-sm text-no">{error}</p>}

      <section className="flex flex-col gap-2 border-t-2 border-dashed border-line pt-6">
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={() => run(() => api("/api/auth/abmelden", { body: {} }))}
        >
          Abmelden
        </button>
        <button
          className="text-sm text-muted underline underline-offset-4"
          disabled={busy}
          onClick={() => run(() => api("/api/auth/abmelden", { body: { everywhere: true } }))}
        >
          Auf allen Geräten abmelden
        </button>
      </section>
    </>
  );
}
