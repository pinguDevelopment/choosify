"use client";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { api } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { Average, StarsDisplay, StarsInput } from "./Stars";
import { useT } from "@/components/I18nProvider";

type Page = {
  film: { title: string; poster: string | null; year: number | null };
  crew: string;
  count: number;
  mine: { name: string; stars: number } | null;
  average: number | null;
  ratings: { name: string; stars: number; mine: boolean }[];
};

const NAME_KEY = "choosify-name";

export function RateClient({ token }: { token: string }) {
  const url = `/api/bewerten/${encodeURIComponent(token)}`;
  const [data, setData] = useState<Page | null>(null);
  const [name, setName] = useState("");
  const [stars, setStars] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const t = useT();

  // Next.js versteckt Seiten beim Navigieren nur und behält ihren State: Ladezustand beim Verlassen zurücksetzen.
  useLayoutEffect(() => () => setBusy(false), []);

  const load = useCallback(() => {
    api<Page>(url)
      .then((d) => {
        setData(d);
        setLoadError(null);
        if (d.mine) {
          setName(d.mine.name);
          setStars(d.mine.stars);
        } else {
          // Name aus dem Link der Runde (?name=) oder vom letzten Mal auf diesem Gerät
          let pre = new URLSearchParams(window.location.search).get("name") ?? "";
          try {
            pre ||= localStorage.getItem(NAME_KEY) ?? "";
          } catch {}
          setName((n) => n || pre.slice(0, 30));
        }
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [url]);
  useEffect(load, [load]);

  if (loadError) {
    return (
      <div className="card text-center">
        <h1 className="text-3xl">{loadError}</h1>
        <p className="mt-2 text-muted">{t.rate.newLink}</p>
        <Link href="/" className="btn-ghost mt-4">
          {t.common.toHome}
        </Link>
      </div>
    );
  }
  if (!data) return <p className="py-10 text-center text-muted">{t.common.loading}</p>;

  const showForm = !data.mine || editing;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stars || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api<Page>(url, { body: { name, stars } });
      setData(d);
      setEditing(false);
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {}
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pageUrl = () => `${window.location.origin}/bewerten/${token}`;

  return (
    <>
      <section className="flex items-center gap-4 animate-pop">
        {data.film.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.film.poster} alt="" className="h-36 w-24 shrink-0 rounded-xl object-cover shadow-lg" />
        ) : (
          <div className="h-36 w-24 shrink-0 rounded-xl bg-surface-2" />
        )}
        <div className="min-w-0">
          <p className="text-muted">{t.rate.howWas}</p>
          <h1 className="text-4xl leading-none">{data.film.title}</h1>
          <p className="mt-1 text-muted">
            {data.film.year ?? ""} · {t.rate.abspannOf(data.crew)}
          </p>
        </div>
      </section>

      {showForm ? (
        <form onSubmit={submit} className="card flex flex-col gap-4">
          <StarsInput value={stars} onChange={setStars} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">{t.common.yourName}</span>
            <input className="input" placeholder={t.common.namePlaceholder} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy || !stars || !name.trim()}>
            {busy ? t.rate.saving : data.mine ? t.rate.change : t.rate.give}
          </button>
          {error && <p className="text-center text-sm text-no">{error}</p>}
          {!data.mine && (
            <p className="text-center text-sm text-muted">
              {data.count === 0 ? t.rate.first : t.rate.already(data.count)}
              {t.rate.othersAfter}
            </p>
          )}
        </form>
      ) : (
        <section className="card flex flex-col gap-4 animate-pop">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{t.rate.average}</p>
              <Average value={data.average} count={data.ratings.length} />
            </div>
            <button className="text-sm text-muted underline underline-offset-4 hover:text-text" onClick={() => setEditing(true)}>
              {t.rate.edit}
            </button>
          </div>
          <ul className="flex flex-col divide-y divide-line/70">
            {data.ratings.map((r) => (
              <li key={r.name} className="flex items-center justify-between py-2">
                <span className={r.mine ? "font-semibold" : ""}>
                  {r.name}
                  {r.mine && <span className="text-muted">{t.rate.you}</span>}
                </span>
                <StarsDisplay value={r.stars} />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{t.rate.thanks}</p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t.rate.others}</h2>
        <div className="flex gap-3">
          <button
            className="btn-ghost flex-1 py-2.5"
            onClick={async () => {
              if (qr) return setQr(null);
              setQr(await QRCode.toDataURL(pageUrl(), { margin: 1, width: 480, color: { dark: "#2a0a14", light: "#f6e7da" } }));
            }}
          >
            {qr ? t.rate.hideQr : t.rate.showQr}
          </button>
          <button
            className="btn-ghost flex-1 py-2.5"
            onClick={async () => {
              if ((await shareLink(pageUrl(), t.common.rateTitle(data.film.title))) === "copied") {
                setShared(true);
                setTimeout(() => setShared(false), 2000);
              }
            }}
          >
            {shared ? t.common.copied : t.common.shareLink}
          </button>
        </div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL
          <img src={qr} alt={t.rate.qrAlt} className="mx-auto w-60 rounded-xl animate-pop" />
        )}
      </section>
    </>
  );
}
