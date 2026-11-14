import "server-only";
import { z } from "zod";
import { env, tmdbMock } from "./env";
import { mockTmdb } from "./tmdb-mock";
import { discoverParams, featuredRank, type DiscoverOptions, type TmdbMovie, type WatchProviderEntry } from "../candidates";

const BASE = "https://api.themoviedb.org/3";

async function tmdb<T>(path: string, params: URLSearchParams, schema: z.ZodType<T>, revalidate = 3600): Promise<T> {
  if (tmdbMock) return schema.parse(mockTmdb(path, params));
  // Unterstützt beide TMDB-Schlüssel: v3 "API Key" (32 Hex-Zeichen, als Query-Parameter)
  // und v4 "Read Access Token" (lang, als Bearer-Header).
  const key = env().TMDB_READ_TOKEN!;
  const isV3 = /^[0-9a-f]{32}$/i.test(key);
  const query = new URLSearchParams(params);
  if (isV3) query.set("api_key", key);
  const res = await fetch(`${BASE}${path}?${query}`, {
    headers: isV3 ? { Accept: "application/json" } : { Authorization: `Bearer ${key}`, Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`TMDB ${path} antwortete mit ${res.status}`);
  // Externe Daten immer validieren, bevor sie in DB oder UI landen.
  return schema.parse(await res.json());
}

const posterPath = z.string().regex(/^\/[A-Za-z0-9._-]+$/).nullable().optional();

const movieSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().max(300),
  overview: z.string().max(5000).optional(),
  poster_path: posterPath,
  release_date: z.string().optional(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
  popularity: z.number().optional(),
  genre_ids: z.array(z.number().int()).optional(),
});

export type Genre = { id: number; name: string };
export type Provider = { id: number; name: string; logoPath: string | null; priority: number; featured: boolean };

export async function getGenres(): Promise<Genre[]> {
  const data = await tmdb(
    "/genre/movie/list",
    new URLSearchParams({ language: "de-DE" }),
    z.object({ genres: z.array(z.object({ id: z.number().int(), name: z.string().max(60) })) }),
    86400,
  );
  return data.genres;
}

export async function getProviders(region: string): Promise<Provider[]> {
  const data = await tmdb(
    "/watch/providers/movie",
    new URLSearchParams({ language: "de-DE", watch_region: region }),
    z.object({
      results: z.array(
        z.object({
          provider_id: z.number().int(),
          provider_name: z.string().max(100),
          logo_path: posterPath,
          display_priorities: z.record(z.string(), z.number()).optional(),
        }),
      ),
    }),
    86400,
  );
  // Bekannte Dienste zuerst (feste Reihenfolge), danach der Rest nach TMDB-Priorität
  return data.results
    .map((p) => {
      const rank = featuredRank(p.provider_name, p.provider_id);
      return {
        id: p.provider_id,
        name: p.provider_name,
        logoPath: p.logo_path ?? null,
        priority: rank >= 0 ? rank - 1000 : (p.display_priorities?.[region] ?? 999),
        featured: rank >= 0,
      };
    })
    .sort((a, b) => a.priority - b.priority);
}

export async function discover(o: DiscoverOptions): Promise<{ results: TmdbMovie[]; totalPages: number }> {
  const data = await tmdb(
    "/discover/movie",
    discoverParams(o),
    z.object({ results: z.array(movieSchema), total_pages: z.number().int().nonnegative().optional() }),
    1800,
  );
  return { results: data.results, totalPages: data.total_pages ?? 1 };
}

const providerList = z.array(z.object({ provider_id: z.number().int() })).optional();

export type MovieDetails = {
  /** Wo läuft der Film in der Region (undefined = nirgends) */
  providers: WatchProviderEntry | undefined;
  /** englische TMDB-Schlagwörter, werden nur intern auf deutsche Tags abgebildet */
  keywords: string[];
  runtime: number | null;
};

/**
 * Ein Abruf pro Film für alles, was die Karte braucht: Streaming-Verfügbarkeit, Schlagwörter
 * und Laufzeit (TMDB append_to_response statt drei einzelner Abrufe).
 */
export async function getMovieDetails(id: number, region: string): Promise<MovieDetails> {
  const data = await tmdb(
    `/movie/${id}`,
    new URLSearchParams({ append_to_response: "keywords,watch/providers" }),
    z.object({
      runtime: z.number().int().nonnegative().max(1000).nullable().optional(),
      keywords: z.object({ keywords: z.array(z.object({ name: z.string().max(100) })).max(200).optional() }).optional(),
      "watch/providers": z
        .object({ results: z.record(z.string(), z.object({ flatrate: providerList, free: providerList, ads: providerList })) })
        .optional(),
    }),
    21600,
  );
  return {
    providers: data["watch/providers"]?.results[region],
    keywords: (data.keywords?.keywords ?? []).map((k) => k.name),
    runtime: data.runtime || null,
  };
}

export async function getMovie(id: number): Promise<TmdbMovie> {
  return tmdb(`/movie/${id}`, new URLSearchParams({ language: "de-DE" }), movieSchema, 86400);
}

export async function searchMovies(query: string): Promise<TmdbMovie[]> {
  const data = await tmdb(
    "/search/movie",
    new URLSearchParams({ language: "de-DE", query, include_adult: "false" }),
    z.object({ results: z.array(movieSchema) }),
    600,
  );
  return data.results.slice(0, 10);
}

export const posterUrl = (path: string | null | undefined, size: "w342" | "w500" | "w92" = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
