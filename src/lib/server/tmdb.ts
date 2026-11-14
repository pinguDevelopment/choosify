import "server-only";
import { z } from "zod";
import { env } from "./env";
import { discoverParams, type DiscoverOptions, type TmdbMovie } from "../candidates";

const BASE = "https://api.themoviedb.org/3";

async function tmdb<T>(path: string, params: URLSearchParams, schema: z.ZodType<T>, revalidate = 3600): Promise<T> {
  const res = await fetch(`${BASE}${path}?${params}`, {
    headers: { Authorization: `Bearer ${env().TMDB_READ_TOKEN}`, Accept: "application/json" },
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
export type Provider = { id: number; name: string; logoPath: string | null; priority: number };

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
  return data.results
    .map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path ?? null,
      priority: p.display_priorities?.[region] ?? 999,
    }))
    .sort((a, b) => a.priority - b.priority);
}

export async function discover(o: DiscoverOptions): Promise<TmdbMovie[]> {
  const data = await tmdb(
    "/discover/movie",
    discoverParams(o),
    z.object({ results: z.array(movieSchema) }),
    1800,
  );
  return data.results;
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
