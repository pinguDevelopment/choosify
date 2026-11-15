"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { Average, StarsDisplay } from "./Stars";
import { useT } from "@/components/I18nProvider";

type Entry = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  average: number | null;
  ratings: { name: string; stars: number }[];
  rateToken: string;
};
type Taste = { rated: number; likes: string[]; dislikes: string[] };
type Data = { crew: { name: string } | null; movies: Entry[]; taste: Taste | null };
type Hit = { tmdbId: number; title: string; poster: string | null; year: number | null };

export function AbspannClient() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const load = useCallback(() => {
    api<Data>("/api/abspann").then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // Suche mit kleiner Verzögerung, damit nicht jeder Tastendruck eine Anfrage auslöst.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      api<{ results: Hit[] }>(`/api/tmdb/search?q=${encodeURIComponent(q)}`)
        .then((d) => setHits(d.results))
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (!data) return <p className="text-muted">{error ?? t.common.loading}</p>;
  if (!data.crew) {
    return (
      <div className="card">
        <h2 className="text-3xl">{t.abspann.noCrewTitle}</h2>
        <p className="mt-2 text-muted">{t.abspann.noCrewText}</p>
        <Link href="/" className="btn-primary mt-4">
          {t.common.startRound}
        </Link>
        <p className="mt-4 text-sm text-muted">
          {t.abspann.otherDevice(
            <Link href="/konto" className="underline underline-offset-4">
              {t.abspann.signInLink}
            </Link>,
          )}
        </p>
      </div>
    );
  }

  const known = new Set(data.movies.map((m) => m.tmdbId));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t.abspann.add}</h2>
        <input className="input" placeholder={t.abspann.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query.trim().length >= 2 && hits.length > 0 && (
          <ul className="flex flex-col gap-2">
            {hits.map((h) => (
              <li key={h.tmdbId}>
                <button
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface disabled:opacity-50"
                  disabled={known.has(h.tmdbId)}
                  onClick={async () => {
                    try {
                      await api("/api/abspann", { body: { tmdbId: h.tmdbId } });
                      setQuery("");
                      setHits([]);
                      load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Thumb src={h.poster} />
                  <span className="flex-1">
                    {h.title} <span className="text-muted">{h.year ?? ""}</span>
                  </span>
                  <span className="pr-2 text-accent">{known.has(h.tmdbId) ? t.abspann.already : t.abspann.addButton}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.taste && data.movies.length > 0 && <TasteCard taste={data.taste} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">
          {data.crew.name} <span className="text-muted">({data.movies.length})</span>
        </h2>
        {data.movies.length === 0 && <p className="text-muted">{t.abspann.empty}</p>}
        <ul className="flex flex-col gap-2">
          {data.movies.map((m) => (
            <li key={m.tmdbId} className="rounded-xl bg-surface">
              <button
                className="flex w-full items-center gap-3 p-2 pr-3 text-left"
                aria-expanded={open === m.tmdbId}
                onClick={() => setOpen(open === m.tmdbId ? null : m.tmdbId)}
              >
                <Thumb src={m.poster} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold">{m.title}</span>
                  <span className="text-sm text-muted">{m.year ?? t.common.yearUnknown}</span>
                  <Average value={m.average} count={m.ratings.length} />
                </span>
                <span aria-hidden className={`text-muted transition-transform ${open === m.tmdbId ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              {open === m.tmdbId && (
                <div className="flex flex-col gap-3 border-t border-line/70 px-3 pt-2 pb-3 animate-pop">
                  {m.ratings.length > 0 ? (
                    <ul className="flex flex-col">
                      {m.ratings.map((r) => (
                        <li key={r.name} className="flex items-center gap-2 py-1">
                          <span className="flex-1 truncate">{r.name}</span>
                          <StarsDisplay value={r.stars} />
                          <button
                            className="px-1 text-muted hover:text-no"
                            aria-label={t.abspann.deleteRating(r.name)}
                            onClick={async () => {
                              try {
                                await api("/api/abspann/bewertung", { method: "DELETE", body: { tmdbId: m.tmdbId, name: r.name } });
                                load();
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">{t.abspann.noRatings}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/bewerten/${m.rateToken}`} className="btn-primary flex-1 py-2 text-base">
                      {t.common.rateButton}
                    </Link>
                    <button
                      className="btn-ghost flex-1 py-2"
                      onClick={async () => {
                        if ((await shareLink(`${window.location.origin}/bewerten/${m.rateToken}`, t.common.rateTitle(m.title))) === "copied") {
                          setCopied(m.tmdbId);
                          setTimeout(() => setCopied(null), 2000);
                        }
                      }}
                    >
                      {copied === m.tmdbId ? t.common.copied : t.common.shareLink}
                    </button>
                  </div>
                  <button
                    className="self-start text-sm text-muted underline decoration-line underline-offset-4 hover:text-no"
                    aria-label={t.abspann.remove(m.title)}
                    onClick={async () => {
                      try {
                        await api("/api/abspann", { method: "DELETE", body: { tmdbId: m.tmdbId } });
                        load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {t.abspann.removeButton}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      {error && <p className="text-center text-sm text-no">{error}</p>}
    </>
  );
}

/** Was die Crew mag, gelernt aus den Sternen. */
function TasteCard({ taste }: { taste: Taste }) {
  const t = useT();
  return (
    <section className="card flex flex-col gap-3">
      <h2 className="text-2xl">{t.abspann.taste}</h2>
      {taste.likes.length || taste.dislikes.length ? (
        <>
          {taste.likes.length > 0 && <TasteRow label={t.abspann.moreOf} items={taste.likes} good />}
          {taste.dislikes.length > 0 && <TasteRow label={t.abspann.rather} items={taste.dislikes} />}
          <p className="text-sm text-muted">
            {t.abspann.learned(taste.rated)}
          </p>
        </>
      ) : (
        <p className="text-muted">
          {taste.rated
            ? t.abspann.unclear
            : t.abspann.rateMore}
        </p>
      )}
    </section>
  );
}

function TasteRow({ label, items, good }: { label: string; items: string[]; good?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-muted">{label}</span>
      {items.map((t) => (
        <span key={t} className={`rounded-full border-2 px-3 py-1 text-sm ${good ? "border-yes/60 text-yes" : "border-no/50 text-no"}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-14 w-10 rounded-md object-cover" />
  ) : (
    <div className="h-14 w-10 rounded-md bg-surface-2" />
  );
}
