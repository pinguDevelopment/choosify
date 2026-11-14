// Reine Logik ohne Server-Abhängigkeiten, damit sie einfach testbar ist.

export type TmdbMovie = {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
};

export type DiscoverOptions = {
  region: string;
  providerIds: number[];
  genreIds: number[];
  page: number;
};

/** Baut die Query für TMDB /discover/movie. "|" bedeutet ODER bei TMDB. */
export function discoverParams(o: DiscoverOptions): URLSearchParams {
  const p = new URLSearchParams({
    language: "de-DE",
    region: o.region,
    watch_region: o.region,
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "150",
    page: String(o.page),
  });
  if (o.providerIds.length) {
    p.set("with_watch_providers", o.providerIds.join("|"));
    p.set("with_watch_monetization_types", "flatrate|free|ads");
  }
  if (o.genreIds.length) p.set("with_genres", o.genreIds.join("|"));
  return p;
}

/** Wie viele Teilnehmer wollen welches Genre? */
export function genreDemand(selections: number[][]): Map<number, number> {
  const m = new Map<number, number>();
  for (const sel of selections) for (const g of new Set(sel)) m.set(g, (m.get(g) ?? 0) + 1);
  return m;
}

/**
 * Wählt die Kandidaten für einen Raum aus:
 *  - Filme aus dem Abspann (schon gesehen) fliegen raus
 *  - Duplikate fliegen raus
 *  - Score = Summe der Nachfrage über die Genres des Films, danach TMDB-Bewertung
 */
export function pickCandidates(
  movies: TmdbMovie[],
  selections: number[][],
  watchedIds: Iterable<number>,
  limit = 30,
): TmdbMovie[] {
  const watched = new Set(watchedIds);
  const demand = genreDemand(selections);
  const seen = new Set<number>();
  const scored: { m: TmdbMovie; score: number }[] = [];
  for (const m of movies) {
    if (watched.has(m.id) || seen.has(m.id)) continue;
    seen.add(m.id);
    const score = (m.genre_ids ?? []).reduce((s, g) => s + (demand.get(g) ?? 0), 0);
    scored.push({ m, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || (b.m.vote_average ?? 0) - (a.m.vote_average ?? 0),
  );
  return scored.slice(0, limit).map((s) => s.m);
}

export function releaseYear(date?: string): number | null {
  const y = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isInteger(y) && y > 1800 ? y : null;
}
