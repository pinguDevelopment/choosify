import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";
import { AppError } from "./http";
import { cookieBase } from "./cookie-opts";
import { posterUrl } from "./tmdb";
import { hashSecret, newSecret, parseRateToken, rateToken } from "./tokens";
import { averageStars, crewTaste, EMPTY_TASTE, type Taste } from "../taste";

// Wer bewertet, bekommt ein eigenes Token (256 Bit) im httpOnly-Cookie. Damit kann dieselbe
// Person ihre Sterne später ändern, ohne Konto. In der Datenbank steht nur der HMAC.
const RATER_COOKIE = "fa_rater";

async function raterHash(create: boolean): Promise<string | null> {
  const jar = await cookies();
  let secret = jar.get(RATER_COOKIE)?.value;
  if (!secret || secret.length > 100) {
    if (!create) return null;
    secret = newSecret();
    jar.set(RATER_COOKIE, secret, { ...cookieBase, maxAge: 60 * 60 * 24 * 365 });
  }
  return hashSecret(`rater:${secret}`, env().APP_SECRET);
}

export const rateLink = (crewId: string, tmdbId: number) => rateToken(crewId, tmdbId, env().APP_SECRET);

/** Film und Crew zu einem Bewertungslink, oder 404, wenn der Link falsch ist oder der Film nicht mehr im Abspann steht. */
async function loadTarget(token: string) {
  const t = parseRateToken(token, env().APP_SECRET);
  if (!t) throw new AppError(404, "Dieser Bewertungslink ist ungültig");
  const { data, error } = await db()
    .from("abspann")
    .select("crew_id, tmdb_id, title, poster_path, release_year, crews(name)")
    .eq("crew_id", t.crewId)
    .eq("tmdb_id", t.tmdbId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, "Diesen Film gibt es im Abspann nicht mehr");
  const crew = data.crews as unknown as { name: string } | null;
  return {
    crewId: data.crew_id as string,
    tmdbId: data.tmdb_id as number,
    film: { title: data.title as string, poster: posterUrl(data.poster_path, "w342"), year: data.release_year as number | null },
    crewName: crew?.name ?? "Crew",
  };
}

type RatingRow = { name: string; stars: number; rater_hash?: string };

async function ratingsOf(crewId: string, tmdbId: number): Promise<RatingRow[]> {
  const { data, error } = await db()
    .from("ratings")
    .select("name, stars, rater_hash")
    .eq("crew_id", crewId)
    .eq("tmdb_id", tmdbId)
    .order("rated_at");
  if (error) throw error;
  return data ?? [];
}

/**
 * Seite zum Bewerten. Die Sterne der anderen sieht man erst nach der eigenen Bewertung,
 * damit niemand sich nach den anderen richtet.
 */
export async function ratingPage(token: string) {
  const target = await loadTarget(token);
  const [rows, me] = await Promise.all([ratingsOf(target.crewId, target.tmdbId), raterHash(false)]);
  const mine = rows.find((r) => r.rater_hash === me) ?? null;
  return {
    film: target.film,
    crew: target.crewName,
    count: rows.length,
    mine: mine ? { name: mine.name, stars: mine.stars } : null,
    average: mine ? averageStars(rows.map((r) => r.stars)) : null,
    ratings: mine ? rows.map((r) => ({ name: r.name, stars: r.stars, mine: r === mine })) : [],
  };
}

export async function rate(token: string, name: string, stars: number) {
  const target = await loadTarget(token);
  const hash = (await raterHash(true))!;
  const { error } = await db().from("ratings").upsert({
    crew_id: target.crewId,
    tmdb_id: target.tmdbId,
    rater_hash: hash,
    name,
    stars,
    rated_at: new Date().toISOString(),
  });
  if (error?.code === "23505") throw new AppError(409, "Diesen Namen hat bei diesem Film schon jemand anderes benutzt");
  if (error?.code === "P0001") throw new AppError(409, "Diesen Film haben schon genug Leute bewertet");
  if (error?.code === "23503") throw new AppError(404, "Diesen Film gibt es im Abspann nicht mehr");
  if (error) throw error;
}

/** Die Crew darf einzelne Bewertungen löschen, falls ein Link in falsche Hände geraten ist. */
export async function removeRating(crewId: string, tmdbId: number, name: string) {
  const { error } = await db().from("ratings").delete().eq("crew_id", crewId).eq("tmdb_id", tmdbId).ilike("name", escapeLike(name));
  if (error) throw error;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Alle Bewertungen der Crew, gruppiert nach Film. */
export async function crewRatings(crewId: string): Promise<Map<number, { name: string; stars: number }[]>> {
  const { data, error } = await db()
    .from("ratings")
    .select("tmdb_id, name, stars")
    .eq("crew_id", crewId)
    .order("rated_at")
    .limit(5000);
  if (error) throw error;
  const out = new Map<number, { name: string; stars: number }[]>();
  for (const r of data ?? []) out.set(r.tmdb_id, [...(out.get(r.tmdb_id) ?? []), { name: r.name, stars: r.stars }]);
  return out;
}

/** Geschmack der Crew aus Abspann (Genres, Tags) und Sternen. */
export async function loadCrewTaste(crewId: string, abspann?: { tmdb_id: number; genre_ids: number[]; tags: string[] }[]): Promise<Taste> {
  const [rows, ratings] = await Promise.all([
    abspann
      ? Promise.resolve(abspann)
      : db()
          .from("abspann")
          .select("tmdb_id, genre_ids, tags")
          .eq("crew_id", crewId)
          .limit(2000)
          .then(({ data, error }) => {
            if (error) throw error;
            return data ?? [];
          }),
    crewRatings(crewId),
  ]);
  if (!ratings.size) return EMPTY_TASTE;
  return crewTaste(
    rows.map((r) => ({ genreIds: r.genre_ids ?? [], tags: r.tags ?? [], stars: (ratings.get(r.tmdb_id) ?? []).map((x) => x.stars) })),
  );
}
