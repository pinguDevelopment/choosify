"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rememberInvite } from "@/lib/invite";
import { useT } from "@/components/I18nProvider";

type Info = { name: string; member: boolean; signedIn: boolean };

/** Einladung in eine gemeinsame Watchlist annehmen (vorher ggf. anmelden). */
export function InviteClient({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    api<Info>(`/api/einladung/${encodeURIComponent(token)}`).then(setInfo, (e) => setError(e.message));
  }, [token]);

  if (!info) {
    return (
      <div className="card flex flex-col gap-3">
        <p className={error ? "text-no" : "text-muted"}>{error ?? t.common.loading}</p>
        {error && (
          <Link href="/" className="btn-ghost">
            {t.common.toHome}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4">
      <h1 className="text-3xl">{t.invite.heading(info.name)}</h1>
      <p className="text-muted">{t.invite.text}</p>
      {info.member || joined ? (
        <>
          <p className="text-yes">{t.invite.member}</p>
          <Link href="/watchlist" className="btn-primary">
            {t.invite.open}
          </Link>
        </>
      ) : info.signedIn ? (
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api(`/api/einladung/${encodeURIComponent(token)}`, { body: {} });
              setJoined(true);
            } catch (e) {
              setError((e as Error).message);
            }
            setBusy(false);
          }}
        >
          {busy ? t.invite.joining : t.invite.join}
        </button>
      ) : (
        <>
          <p>{t.invite.signInFirst}</p>
          <Link href="/konto" className="btn-primary" onClick={() => rememberInvite(token)}>
            {t.invite.signIn}
          </Link>
        </>
      )}
      {error && <p className="text-sm text-no">{error}</p>}
    </div>
  );
}
