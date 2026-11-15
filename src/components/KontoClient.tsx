"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type AccountInfo } from "@/lib/api";
import { loadLocalFavorites, saveLocalFavorites } from "@/lib/favorites";
import { useT } from "@/components/I18nProvider";

export function KontoClient() {
  const [account, setAccount] = useState<AccountInfo | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const load = useCallback(() => {
    api<{ account: AccountInfo | null }>("/api/konto")
      .then((d) => {
        setAccount(d.account);
        if (d.account) saveLocalFavorites(d.account.favorites);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (account === undefined) return <p className="text-muted">{error ?? t.common.loading}</p>;
  if (account === null) return <LoginForm onDone={load} />;
  return <AccountView account={account} reload={load} />;
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

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
        <h2 className="text-3xl">{t.account.signIn}</h2>
        <p className="text-muted">{t.account.noPassword}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted">{t.account.email}</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            maxLength={254}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.account.emailPlaceholder}
            required
          />
        </label>
        {error && <p className="text-sm text-no">{error}</p>}
        <button className="btn-primary" disabled={busy || !email.includes("@")}>
          {busy ? t.account.sending : t.account.send}
        </button>
      </form>
    );
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={verify}>
      <h2 className="text-3xl">{t.account.checkInbox}</h2>
      <p className="text-muted">
        {t.account.sent(<span className="text-text">{sentTo}</span>)}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted">{t.account.code}</span>
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
        {busy ? t.account.checking : t.account.signIn}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-muted underline underline-offset-4" onClick={() => setSentTo(null)}>
          {t.account.otherAddress}
        </button>
        <button type="button" className="text-muted underline underline-offset-4" disabled={busy} onClick={() => send()}>
          {t.account.resend}
        </button>
      </div>
      <p className="text-sm text-muted">{t.account.spam}</p>
    </form>
  );
}

function AccountView({ account, reload }: { account: AccountInfo; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

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
        <span className="text-sm text-muted">{t.account.signedInAs}</span>
        <span className="truncate text-lg font-semibold">{account.email}</span>
      </section>

      {account.deviceCrew && (
        <section className="card flex flex-col gap-3 border-accent">
          <h2 className="text-2xl">{t.account.adoptTitle}</h2>
          <p className="text-muted">
            {t.account.adoptText(<span className="text-text">{t.account.quote(account.deviceCrew.name)}</span>)}
          </p>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => run(() => api("/api/konto", { method: "PATCH", body: { adoptDeviceCrew: true } }))}
          >
            {t.account.adopt}
          </button>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">{t.account.crews}</h2>
        {account.crews.length === 0 ? (
          <p className="text-muted">
            {t.account.noCrews}{" "}
            <Link href="/" className="underline underline-offset-4">
              {t.common.startRound}
            </Link>
          </p>
        ) : (
          <>
            {account.crews.length > 1 && (
              <p className="text-sm text-muted">{t.account.activeHint}</p>
            )}
            <ul className="flex flex-col gap-2" role="radiogroup" aria-label={t.account.activeCrew}>
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
                    {c.active && <span className="text-sm text-accent">{t.account.active}</span>}
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
          {t.account.signOut}
        </button>
        <button
          className="text-sm text-muted underline underline-offset-4"
          disabled={busy}
          onClick={() => run(() => api("/api/auth/abmelden", { body: { everywhere: true } }))}
        >
          {t.account.signOutAll}
        </button>
      </section>
    </>
  );
}
