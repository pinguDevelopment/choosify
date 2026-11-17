"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, type AccountInfo } from "@/lib/api";
import { loadLocalFavorites, saveLocalFavorites } from "@/lib/favorites";
import { useT } from "@/components/I18nProvider";
import { CrewManager } from "@/components/CrewManager";
import { takePendingInvite } from "@/lib/invite";

export function KontoClient() {
  const [account, setAccount] = useState<AccountInfo | null | undefined>(undefined);
  const [google, setGoogle] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const router = useRouter();

  const load = useCallback(() => {
    // Rückkehr von der Google-Anmeldung: ?google=1 (geklappt) oder ?google=fehler
    const params = new URLSearchParams(window.location.search);
    const fromGoogle = params.get("google");
    if (fromGoogle) {
      params.delete("google");
      const rest = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
    api<{ account: AccountInfo | null; google?: boolean }>("/api/konto")
      .then(async (d) => {
        if (d.account && fromGoogle === "1") {
          // Wie beim Mail-Login: Lieblingsdienste von diesem Gerät ins Konto übernehmen
          const merged = mergeFavorites(d.account.favorites, loadLocalFavorites());
          if (merged.ids.length !== d.account.favorites.ids.length || merged.other !== d.account.favorites.other) {
            await api("/api/konto", { method: "PATCH", body: { favorites: merged } }).catch(() => {});
            d.account.favorites = merged;
          }
        }
        if (d.account) {
          // Kam die Person über eine Einladung hierher, geht es nach dem Anmelden dorthin zurück
          const invite = takePendingInvite();
          if (invite) {
            router.replace(`/einladung/${invite}`);
            return;
          }
        }
        setAccount(d.account);
        setGoogle(d.google === true);
        if (fromGoogle) setGoogleFailed(fromGoogle === "fehler");
        if (d.account) saveLocalFavorites(d.account.favorites);
      })
      .catch((e) => setError(e.message));
  }, [router]);
  useEffect(load, [load]);

  if (account === undefined) return <p className="text-muted">{error ?? t.common.loading}</p>;
  if (account === null) return <LoginForm onDone={load} google={google} googleFailed={googleFailed} />;
  return <AccountView account={account} reload={load} />;
}

function mergeFavorites(a: { ids: number[]; other: boolean }, b: { ids: number[]; other: boolean }) {
  return { ids: [...new Set([...a.ids, ...b.ids])].slice(0, 60), other: a.other || b.other };
}

/** Google-Logo (die vier Farben gehören zu Googles Vorgaben für Anmeldeknöpfe). */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function LoginForm({ onDone, google, googleFailed }: { onDone: () => void; google: boolean; googleFailed: boolean }) {
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
        {google && (
          <>
            {/* Normaler Link statt fetch: Die Anmeldung läuft über Weiterleitungen zu Google und zurück.
                In der Handy-App fängt die App diesen Link ab und öffnet ihn im Browser. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API-Weiterleitung, keine Seite */}
            <a
              href="/api/auth/google?next=/konto"
              className="flex items-center justify-center gap-3 rounded-xl border-2 border-line bg-white px-4 py-3 font-semibold text-[#1f1f1f] hover:border-muted"
            >
              <GoogleLogo />
              {t.account.google}
            </a>
            {googleFailed && <p className="text-sm text-no">{t.account.googleFailed}</p>}
            <p className="text-center text-sm text-muted">{t.account.orMail}</p>
          </>
        )}
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

      <CrewManager crews={account.crews} reload={reload} />

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
