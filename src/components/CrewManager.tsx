"use client";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { api, type AccountInfo } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { useT } from "@/components/I18nProvider";

type Crew = AccountInfo["crews"][number];
type Details = {
  id: string;
  name: string;
  owner: boolean;
  inviteUntil: string | null;
  members: { id: string; name: string; owner: boolean; me: boolean }[];
};

const dateText = (iso: string) =>
  new Date(iso).toLocaleDateString(document.documentElement.lang === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long" });

/** Crews des Kontos: auswählen, teilen (Einladungslink), Mitglieder verwalten, neue anlegen. */
export function CrewManager({ crews, reload }: { crews: Crew[]; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl">{t.crews.title}</h2>
        <p className="mt-1 text-sm text-muted">{t.crews.intro}</p>
      </div>
      {crews.length === 0 ? (
        <p className="text-muted">
          {t.account.noCrews}{" "}
          <Link href="/" className="underline underline-offset-4">
            {t.common.startRound}
          </Link>
        </p>
      ) : (
        <>
          {crews.length > 1 && <p className="text-sm text-muted">{t.account.activeHint}</p>}
          <ul className="flex flex-col gap-2" role="radiogroup" aria-label={t.account.activeCrew}>
            {crews.map((c) => (
              <li key={c.id} className={`rounded-xl border-2 ${c.active ? "border-accent bg-surface" : "border-line"}`}>
                <div className="flex items-center gap-2 p-1">
                  <button
                    role="radio"
                    aria-checked={c.active}
                    disabled={busy}
                    onClick={() => !c.active && run(() => api("/api/konto", { method: "PATCH", body: { crewId: c.id } }))}
                    className="flex min-w-0 flex-1 flex-col items-start rounded-lg p-2 text-left hover:bg-surface"
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="truncate font-semibold">{c.name}</span>
                      {c.active && <span className="text-sm text-accent">{t.account.active}</span>}
                    </span>
                    {c.members > 1 && <span className="text-sm text-muted">👥 {t.crews.shared(c.members)}</span>}
                  </button>
                  <button
                    className="shrink-0 px-2 py-2 text-sm text-muted underline decoration-line underline-offset-4 hover:text-text"
                    aria-expanded={open === c.id}
                    onClick={() => setOpen(open === c.id ? null : c.id)}
                  >
                    {open === c.id ? t.crews.close : t.crews.manage}
                  </button>
                </div>
                {open === c.id && <CrewPanel crewId={c.id} onChanged={reload} onLeft={() => setOpen(null)} />}
              </li>
            ))}
          </ul>
        </>
      )}
      <NewCrew busy={busy} onCreate={(name) => run(() => api("/api/crews", { body: { name } }))} />
      {error && <p className="text-sm text-no">{error}</p>}
    </section>
  );
}

function NewCrew({ busy, onCreate }: { busy: boolean; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const t = useT();
  return (
    <form
      className="card flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await onCreate(name);
        setName("");
      }}
    >
      <h3 className="text-xl">{t.crews.newTitle}</h3>
      <p className="text-sm text-muted">{t.crews.newText}</p>
      <div className="flex gap-2">
        <input
          className="input min-w-0 flex-1"
          aria-label={t.crews.name}
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.crews.newPlaceholder}
          required
        />
        <button className="btn-primary shrink-0 px-4" disabled={busy || !name.trim()}>
          {t.crews.create}
        </button>
      </div>
    </form>
  );
}

/** Mitglieder, Name und Einladungslink einer Crew. */
function CrewPanel({ crewId, onChanged, onLeft }: { crewId: string; onChanged: () => void; onLeft: () => void }) {
  const [d, setD] = useState<Details | null>(null);
  const [name, setName] = useState("");
  const [link, setLink] = useState<{ url: string; until: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const load = useCallback(() => {
    api<Details>(`/api/crews/${crewId}`)
      .then((x) => {
        setD(x);
        setName(x.name);
      })
      .catch((e) => setError(e.message));
  }, [crewId]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link.url, { margin: 1, width: 360, color: { dark: "#2a0a14", light: "#f6e7da" } }).then(setQr, () => setQr(null));
  }, [link]);

  async function patch(body: object, after?: (r: { invite: { token: string; until: string } | null }) => void) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ invite: { token: string; until: string } | null }>(`/api/crews/${crewId}`, { method: "PATCH", body });
      after?.(r);
      load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (!d) return <p className="px-3 pb-3 text-sm text-muted">{error ?? t.common.loading}</p>;
  const me = d.members.find((m) => m.me);

  return (
    <div className="flex flex-col gap-4 border-t border-line/70 px-3 pt-3 pb-4 animate-pop">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== d.name) patch({ name });
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm text-muted">{t.crews.name}</span>
          <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn-ghost shrink-0 px-4 py-3" disabled={busy || !name.trim() || name.trim() === d.name}>
          {t.crews.save}
        </button>
      </form>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">{t.crews.members}</h3>
        <ul className="flex flex-col">
          {d.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1 truncate">
                {m.name}
                {m.me && <span className="text-muted"> ({t.crews.you})</span>}
                {m.owner && <span className="text-sm text-muted"> · {t.crews.createdIt}</span>}
              </span>
              {d.owner && !m.me && (
                <button
                  className="px-1 text-muted hover:text-no"
                  aria-label={t.crews.remove(m.name)}
                  disabled={busy}
                  onClick={() => patch({ removeMember: m.id })}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t.crews.inviteTitle}</h3>
        <p className="text-sm text-muted">{t.crews.inviteText}</p>
        {link ? (
          <>
            <div className="flex gap-2">
              <input className="input min-w-0 flex-1 text-sm" readOnly value={link.url} aria-label={t.crews.inviteTitle} onFocus={(e) => e.target.select()} />
              <button
                className="btn-primary shrink-0 px-4"
                onClick={async () => {
                  if ((await shareLink(link.url, t.crews.inviteShareTitle(d.name))) === "copied") {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {copied ? t.common.copied : t.common.shareLink}
              </button>
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={t.crews.inviteQr} className="mx-auto w-48 rounded-xl" />
            )}
            <p className="text-sm text-muted">{t.crews.inviteValid(dateText(link.until))}</p>
          </>
        ) : (
          d.inviteUntil && <p className="text-sm text-muted">{t.crews.inviteActive(dateText(d.inviteUntil))}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className={`${link ? "btn-ghost" : "btn-primary"} flex-1 py-2`}
            disabled={busy}
            onClick={() =>
              patch({ invite: "new" }, (r) => r.invite && setLink({ url: `${window.location.origin}/einladung/${r.invite.token}`, until: r.invite.until }))
            }
          >
            {link || d.inviteUntil ? t.crews.inviteNew : t.crews.inviteCreate}
          </button>
          {(link || d.inviteUntil) && (
            <button
              className="btn-ghost flex-1 py-2"
              disabled={busy}
              onClick={() =>
                patch({ invite: "stop" }, () => {
                  setLink(null);
                  setQr(null);
                })
              }
            >
              {t.crews.inviteStop}
            </button>
          )}
        </div>
      </div>

      {me && d.members.length > 1 && (
        <div className="flex flex-col gap-1">
          {d.owner && <p className="text-sm text-muted">{t.crews.leaveOwnerHint}</p>}
          <button
            className="self-start text-sm text-muted underline decoration-line underline-offset-4 hover:text-no"
            disabled={busy}
            onClick={() => {
              if (!leaving) return setLeaving(true);
              patch({ removeMember: me.id }, onLeft);
            }}
          >
            {leaving ? t.crews.leaveSure : t.crews.leave}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-no">{error}</p>}
    </div>
  );
}
