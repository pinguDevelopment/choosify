"use client";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/components/I18nProvider";
import type { Choice, Movie } from "./types";

/** Antwort von GET /api/movies/[id] */
type MovieInfo = {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  tagline: string | null;
  overview: string | null;
  year: number | null;
  runtime: number | null;
  rating: number | null;
  voteCount: number | null;
  genres: string[];
  countries: string[];
  directors: string[];
  cast: { name: string; character: string | null; photo: string | null }[];
  backdrop: string | null;
  poster: string | null;
  trailerKey: string | null;
  imdbId: string | null;
};

// Pro Seitenaufruf merken, damit erneutes Antippen sofort alles zeigt
const cache = new Map<number, MovieInfo>();

const SHEET_SPRING = { type: "spring", stiffness: 360, damping: 36 } as const;

/**
 * Detailansicht einer Votekarte als Blatt von unten: alles, was auf der Karte keinen Platz hat
 * (ganze Beschreibung, Regie, Besetzung), dazu Trailer und IMDb. Abstimmen geht direkt von hier.
 */
export function MovieSheet({ movie, onClose, onVote }: { movie: Movie; onClose: () => void; onVote?: (c: Choice) => void }) {
  const t = useT();
  const [info, setInfo] = useState<MovieInfo | null>(() => cache.get(movie.tmdbId) ?? null);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (cache.has(movie.tmdbId)) return;
    let alive = true;
    api<MovieInfo>(`/api/movies/${movie.tmdbId}`)
      .then((d) => {
        cache.set(movie.tmdbId, d);
        if (alive) setInfo(d);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [movie.tmdbId]);

  // Fokus ins Blatt, Escape schließt, Seite dahinter scrollt nicht mit
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [onClose]);

  // Bis die Details da sind, zeigt das Blatt die Daten der Karte
  const title = info?.title || movie.title;
  const year = info?.year ?? movie.year;
  const runtime = info?.runtime ?? movie.runtime;
  const rating = info?.rating ?? movie.rating;
  const overview = info?.overview || movie.overview;
  const genres = info?.genres.length ? info.genres : movie.genres;
  const image = info?.backdrop ?? movie.poster;
  const query = encodeURIComponent(`${info?.originalTitle ?? title}${year ? ` ${year}` : ""}`);
  const trailerUrl = info?.trailerKey
    ? `https://www.youtube.com/watch?v=${info.trailerKey}`
    : `https://www.youtube.com/results?search_query=${query}%20trailer`;
  const imdbUrl = info?.imdbId ? `https://www.imdb.com/title/${info.imdbId}/` : `https://www.imdb.com/find/?s=tt&q=${query}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-sheet-title"
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.6rem] bg-surface shadow-[0_-18px_40px_rgb(0_0_0/0.5)]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SHEET_SPRING}
      >
        <div className="overflow-y-auto overscroll-contain">
          <div className="relative h-48 shrink-0 bg-surface-2">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element -- TMDB liefert fertige Größen
              <img src={image} alt="" className={`absolute inset-0 h-full w-full object-cover ${info?.backdrop ? "" : "object-[50%_25%]"}`} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-xl text-text backdrop-blur hover:bg-black/65"
              aria-label={t.details.close}
              title={t.details.close}
            >
              ✕
            </button>
          </div>

          <div className="-mt-10 flex flex-col gap-4 px-5 pb-5">
            <div className="relative">
              {genres.length > 0 && <p className="mb-1 text-xs font-bold tracking-[0.14em] text-accent uppercase">{genres.join(" · ")}</p>}
              <h2 id="movie-sheet-title" className="text-4xl">
                {title}
              </h2>
              {info?.originalTitle && <p className="mt-0.5 text-sm text-muted">{t.details.originalTitle(info.originalTitle)}</p>}
              <p className="mt-1.5 flex flex-wrap gap-x-3 text-muted">
                {year && <span>{year}</span>}
                {runtime != null && <span>{t.swipe.runtime(runtime)}</span>}
                {rating != null && <span className="text-accent">★ {rating.toFixed(1)}</span>}
                {info && info.countries.length > 0 && <span>{info.countries.join(", ")}</span>}
              </p>
              {info?.voteCount ? <p className="text-xs text-muted/80">{t.details.votes(info.voteCount)}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a className="btn-primary text-base" href={trailerUrl} target="_blank" rel="noopener noreferrer" title={t.details.opensNewTab}>
                <span aria-hidden>▶</span> {info && !info.trailerKey ? t.details.trailerSearch : t.details.trailer}
              </a>
              <a className="btn-ghost" href={imdbUrl} target="_blank" rel="noopener noreferrer" title={t.details.opensNewTab}>
                <span className="rounded bg-accent px-1.5 py-0.5 text-sm font-extrabold text-accent-ink">IMDb</span>
                <span className="sr-only">{t.details.imdb}</span>
                <span aria-hidden>↗</span>
              </a>
            </div>

            {info?.tagline && <p className="font-display text-xl text-ticket italic">„{info.tagline}“</p>}
            {overview && <p className="text-[0.98rem] leading-relaxed text-text/90">{overview}</p>}

            {!info && !failed && <p className="animate-pulse text-sm text-muted">{t.details.loading}</p>}
            {failed && <p className="text-sm text-muted">{t.details.failed}</p>}

            {info && info.directors.length > 0 && (
              <p>
                <span className="text-sm text-muted">{t.details.director}</span>
                <br />
                <span className="text-lg">{info.directors.join(", ")}</span>
              </p>
            )}

            {info && info.cast.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-muted">{t.details.cast}</p>
                <ul className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
                  {info.cast.map((c) => (
                    <li key={c.name + c.character} className="w-20 shrink-0 snap-start text-center">
                      {c.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- TMDB liefert fertige Größen
                        <img src={c.photo} alt="" loading="lazy" className="mx-auto h-20 w-20 rounded-full bg-surface-2 object-cover" />
                      ) : (
                        <span aria-hidden className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-surface-2 font-display text-2xl font-extrabold text-muted">
                          {c.name.slice(0, 1)}
                        </span>
                      )}
                      <p className="mt-1.5 text-sm leading-tight">{c.name}</p>
                      {c.character && <p className="line-clamp-2 text-xs leading-tight text-muted">{t.details.as(c.character)}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {onVote && (
          <div className="border-t border-line/70 bg-surface px-5 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
            <p className="sr-only">{t.details.voteHint}</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className="btn border-2 border-no py-2.5 text-no hover:bg-no hover:text-accent-ink" onClick={() => onVote("no")}>
                ✕ {t.swipe.no}
              </button>
              <button type="button" className="btn border-2 border-accent py-2.5 text-accent hover:bg-accent hover:text-accent-ink" onClick={() => onVote("maybe")}>
                {t.swipe.maybe}
              </button>
              <button type="button" className="btn border-2 border-yes py-2.5 text-yes hover:bg-yes hover:text-accent-ink" onClick={() => onVote("yes")}>
                ♥ {t.swipe.yes}
              </button>
            </div>
          </div>
        )}
      </motion.section>
    </div>
  );
}
