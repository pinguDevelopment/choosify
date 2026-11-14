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

/**
 * Vier Töpfe, damit nicht nur aktuelle Blockbuster kommen:
 *  - popular:   was gerade viele schauen
 *  - acclaimed: sehr gut bewertet, mit vielen Stimmen (oft ältere Klassiker)
 *  - classic:   bis einschließlich 2005
 *  - gem:       gut bewertet, aber eher unbekannt (wenige Stimmen)
 */
export const BUCKETS = ["popular", "acclaimed", "classic", "gem"] as const;
export type Bucket = (typeof BUCKETS)[number];
/** Bis zu welcher Seite pro Topf zufällig geblättert wird */
export const BUCKET_MAX_PAGE: Record<Bucket, number> = { popular: 5, acclaimed: 12, classic: 10, gem: 10 };

export type DiscoverOptions = {
  region: string;
  providerIds: number[];
  genreIds: number[];
  page: number;
  bucket?: Bucket;
  /** für Tests; sonst heute */
  today?: Date;
};

/** Filme, die erst seit kurzem draußen sind, laufen oft nur im Kino. */
export const CINEMA_DAYS = 60;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Baut die Query für TMDB /discover/movie. "|" bedeutet ODER bei TMDB. */
export function discoverParams(o: DiscoverOptions): URLSearchParams {
  const bucket = o.bucket ?? "popular";
  const latest = new Date((o.today ?? new Date()).getTime() - CINEMA_DAYS * 86400_000);
  const p = new URLSearchParams({
    language: "de-DE",
    region: o.region,
    watch_region: o.region,
    sort_by: bucket === "acclaimed" || bucket === "gem" ? "vote_average.desc" : "popularity.desc",
    include_adult: "false",
    "vote_count.gte": { popular: "200", acclaimed: "1500", classic: "300", gem: "80" }[bucket],
    "primary_release_date.lte": bucket === "classic" ? "2005-12-31" : isoDate(latest),
    page: String(o.page),
  });
  if (bucket === "gem") {
    p.set("vote_count.lte", "1500");
    p.set("vote_average.gte", "6.8");
  }
  if (o.providerIds.length) {
    p.set("with_watch_providers", o.providerIds.join("|"));
    // Nur Abo, kostenlos oder mit Werbung: nichts, was man extra leihen oder kaufen muss
    p.set("with_watch_monetization_types", "flatrate|free|ads");
  }
  if (o.genreIds.length) p.set("with_genres", o.genreIds.join("|"));
  return p;
}

/** Zufällige Seite innerhalb dessen, was TMDB für diesen Topf hat. */
export function randomPage(bucket: Bucket, totalPages: number, rnd: () => number = Math.random): number {
  const max = Math.max(1, Math.min(totalPages, BUCKET_MAX_PAGE[bucket], 500));
  return 1 + Math.floor(rnd() * max);
}

export type WatchProviderEntry = {
  flatrate?: { provider_id: number }[];
  free?: { provider_id: number }[];
  ads?: { provider_id: number }[];
};

/** Kann man den Film bei einem der gewählten Dienste ohne Aufpreis streamen? */
export function streamableOn(entry: WatchProviderEntry | undefined, providerIds: number[]): number[] {
  if (!entry) return [];
  const wanted = new Set(providerIds);
  const ids = [...(entry.flatrate ?? []), ...(entry.free ?? []), ...(entry.ads ?? [])].map((p) => p.provider_id);
  return [...new Set(ids.filter((id) => wanted.has(id)))];
}

/** Abwechselnd aus jedem Topf nehmen, Doppelte überspringen. */
export function mixBuckets<T extends { id: number }>(lists: T[][], limit: number): T[] {
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const m = l[i];
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Bekannte Dienste in Deutschland, in dieser Reihenfolge angezeigt.
 * Abgleich über den Namen, weil TMDB-IDs je nach Region schwanken; Varianten wie
 * "Netflix Standard with Ads" oder "… Amazon Channel" landen unter "Mehr".
 */
const FEATURED = ["netflix", "amazonprimevideo", "disneyplus", "appletvplus", "wow", "joyn", "rtlplus", "paramountplus", "magentatv", "ardmediathek", "zdf"];
const normalizeProvider = (name: string) => name.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
/** Platz in der Liste der bekannten Dienste, sonst -1 */
export function featuredRank(name: string, id?: number): number {
  const i = FEATURED.indexOf(normalizeProvider(name));
  if (i >= 0) return i;
  return id === 350 ? FEATURED.indexOf("appletvplus") : -1; // Apple TV+ heißt bei TMDB inzwischen teils nur "Apple TV"
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
 *  - optional `taste` (-1 bis +1, aus den Bewertungen der Crew): zählt so viel wie ein
 *    Genre, das alle gewählt haben
 */
export function pickCandidates(
  movies: TmdbMovie[],
  selections: number[][],
  watchedIds: Iterable<number>,
  limit = 30,
  taste?: (m: TmdbMovie) => number,
): TmdbMovie[] {
  const watched = new Set(watchedIds);
  const demand = genreDemand(selections);
  const seen = new Set<number>();
  const scored: { m: TmdbMovie; score: number }[] = [];
  for (const m of movies) {
    if (watched.has(m.id) || seen.has(m.id)) continue;
    seen.add(m.id);
    const score =
      (m.genre_ids ?? []).reduce((s, g) => s + (demand.get(g) ?? 0), 0) +
      (taste ? taste(m) * Math.max(1, selections.length) : 0);
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

export type Choice = "yes" | "maybe" | "no";

const ARTICLES = new Set(["der", "die", "das", "the", "a", "an", "ein", "eine", "le", "la"]);

/**
 * Grober Schlüssel für Filmreihen: "Der Herr der Ringe: Die zwei Türme" und
 * "Der Herr der Ringe - Die Gefährten" ergeben beide "herr der ringe".
 * Ohne Untertitel zählen die ersten zwei Wörter nach dem Artikel ("harry potter").
 */
export function franchiseKey(title: string): string {
  const head = title.split(/\s*[:–—]\s*|\s+-\s+/)[0];
  const words = head
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  const hasSubtitle = head.length < title.length;
  // Ziffern am Ende ("Shrek 2") gehören nicht zum Reihennamen
  while (words.length > 1 && /^\d+$|^[ivx]+$/.test(words.at(-1)!)) words.pop();
  return (hasSubtitle ? words : words.slice(0, 2)).join(" ");
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Eigene Reihenfolge pro Person: fest gemischt (gleicher Seed = gleiche Reihenfolge,
 * damit sich beim Neuladen nichts verschiebt), danach so umsortiert, dass Filme
 * derselben Reihe möglichst weit auseinanderliegen und nicht zweimal hintereinander
 * dieselbe Genre-Kombination kommt.
 */
export function personalOrder<T extends { tmdbId: number; title: string; genreIds?: number[] | null }>(
  movies: T[],
  seed: string,
): T[] {
  const rnd = mulberry32(hashSeed(seed));
  const pool = [...movies].sort((a, b) => a.tmdbId - b.tmdbId); // unabhängig von der DB-Reihenfolge
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Reihen (mehrere Filme mit gleichem Schlüssel) gleichmäßig über die ganze Liste verteilen
  const groups = new Map<string, T[]>();
  for (const m of pool) {
    const k = franchiseKey(m.title);
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const n = pool.length;
  const slots: (T | undefined)[] = Array.from({ length: n }, () => undefined);
  const singles: T[] = [];
  const series = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
  for (const g of groups.values()) if (g.length === 1) singles.push(g[0]);
  for (const g of series) {
    const offset = rnd();
    g.forEach((m, k) => {
      let at = Math.min(n - 1, Math.floor(((k + offset) * n) / g.length));
      // belegt? nächsten freien Platz in der Nähe suchen
      for (let d = 1; slots[at] !== undefined; d++) {
        const cand = [at + d, at - d].find((c) => c >= 0 && c < n && slots[c] === undefined);
        if (cand !== undefined) at = cand;
      }
      slots[at] = m;
    });
  }
  const isSingle = new Set(singles);
  let si = 0;
  const out = slots.map((m) => m ?? singles[si++]);

  // Nicht zweimal hintereinander dieselbe Genre-Kombination: Einzelfilme untereinander tauschen
  const genres = (m: T) => [...(m.genreIds ?? [])].sort((a, b) => a - b).join(",");
  for (let i = 1; i < n; i++) {
    if (genres(out[i]) !== genres(out[i - 1]) || !isSingle.has(out[i])) continue;
    const j = out.findIndex(
      (m, j) =>
        j > i &&
        isSingle.has(m) &&
        genres(m) !== genres(out[i - 1]) &&
        (i + 1 >= n || genres(m) !== genres(out[i + 1])) &&
        genres(out[i]) !== genres(out[j - 1]) &&
        (j + 1 >= n || genres(out[i]) !== genres(out[j + 1])),
    );
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
