import "server-only";
import { cookies } from "next/headers";
import { countAll, db, isForeignKeyViolation, isLimitViolation, isUniqueViolation, upsert } from "./db";
import { env } from "./env";
import { AppError } from "./http";
import { cookieBase } from "./cookie-opts";
import { posterUrl } from "./tmdb";
import { hashSecret, newSecret, parseRateToken, rateToken } from "./tokens";
import { averageStars, crewTaste, EMPTY_TASTE, type Taste } from "../taste";
import type { Locale } from "../i18n/config";

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
async function loadTarget(token: string, locale: Locale) {
  const t = parseRateToken(token, env().APP_SECRET);
  if (!t) throw new AppError(404, "Dieser Bewertungslink ist ungültig");
  const data = await db()
    .selectFrom("abspann as a")
    .innerJoin("crews as c", "c.id", "a.crew_id")
    .select(["a.crew_id", "a.tmdb_id", "a.title", "a.title_en", "a.poster_path", "a.release_year", "c.name as crew_name"])
    .where("a.crew_id", "=", t.crewId)
    .where("a.tmdb_id", "=", t.tmdbId)
    .executeTakeFirst();
  if (!data) throw new AppError(404, "Diesen Film gibt es im Abspann nicht mehr");
  return {
    crewId: data.crew_id,
    tmdbId: data.tmdb_id,
    film: { title: (locale === "en" && data.title_en) || data.title, poster: posterUrl(data.poster_path, "w342"), year: data.release_year },
    crewName: data.crew_name ?? "Crew",
  };
}

type RatingRow = { name: string; stars: number; rater_hash?: string };

async function ratingsOf(crewId: string, tmdbId: number): Promise<RatingRow[]> {
  return db()
    .selectFrom("ratings")
    .select(["name", "stars", "rater_hash"])
    .where("crew_id", "=", crewId)
    .where("tmdb_id", "=", tmdbId)
    .orderBy("rated_at")
    .execute();
}

/**
 * Seite zum Bewerten. Die Sterne der anderen sieht man erst nach der eigenen Bewertung,
 * damit niemand sich nach den anderen richtet.
 */
export async function ratingPage(token: string, locale: Locale = "de") {
  const target = await loadTarget(token, locale);
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
  const target = await loadTarget(token, "de");
  const hash = (await raterHash(true))!;
  const others = await db()
    .selectFrom("ratings")
    .select(["name", "rater_hash"])
    .where("crew_id", "=", target.crewId)
    .where("tmdb_id", "=", target.tmdbId)
    .where("rater_hash", "<>", hash)
    .execute();
  // Vorher prüfen statt auf die Datenbank zu verlassen: MariaDB würde bei gleichem Namen sonst
  // die Bewertung der anderen Person überschreiben (ON DUPLICATE KEY greift bei jedem Unique-Index).
  if (others.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
    throw new AppError(409, "Diesen Namen hat bei diesem Film schon jemand anderes benutzt");
  }
  const mine = others.length < (await countRatings(target.crewId, target.tmdbId));
  if (!mine && others.length >= MAX_RATINGS) throw new AppError(409, "Diesen Film haben schon genug Leute bewertet");
  try {
    await upsert(
      "ratings",
      { crew_id: target.crewId, tmdb_id: target.tmdbId, rater_hash: hash, name, stars, rated_at: new Date().toISOString() },
      ["crew_id", "tmdb_id", "rater_hash"],
    );
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Diesen Namen hat bei diesem Film schon jemand anderes benutzt");
    if (isLimitViolation(err)) throw new AppError(409, "Diesen Film haben schon genug Leute bewertet");
    if (isForeignKeyViolation(err)) throw new AppError(404, "Diesen Film gibt es im Abspann nicht mehr");
    throw err;
  }
}

/** Höchstens so viele Personen bewerten einen Film (früher ein Trigger in Postgres). */
const MAX_RATINGS = 30;

async function countRatings(crewId: string, tmdbId: number): Promise<number> {
  const row = await db().selectFrom("ratings").select(countAll()).where("crew_id", "=", crewId).where("tmdb_id", "=", tmdbId).executeTakeFirst();
  return Number(row?.n ?? 0);
}

/** Die Crew darf einzelne Bewertungen löschen, falls ein Link in falsche Hände geraten ist. */
export async function removeRating(crewId: string, tmdbId: number, name: string) {
  await db()
    .deleteFrom("ratings")
    .where("crew_id", "=", crewId)
    .where("tmdb_id", "=", tmdbId)
    .where((eb) => eb(eb.fn("lower", ["name"]), "=", name.toLowerCase()))
    .execute();
}

/** Alle Bewertungen der Crew, gruppiert nach Film. */
export async function crewRatings(crewId: string): Promise<Map<number, { name: string; stars: number }[]>> {
  const data = await db()
    .selectFrom("ratings")
    .select(["tmdb_id", "name", "stars"])
    .where("crew_id", "=", crewId)
    .orderBy("rated_at")
    .limit(5000)
    .execute();
  const out = new Map<number, { name: string; stars: number }[]>();
  for (const r of data) out.set(r.tmdb_id, [...(out.get(r.tmdb_id) ?? []), { name: r.name, stars: r.stars }]);
  return out;
}

/** Geschmack der Crew aus Abspann (Genres, Tags) und Sternen. */
export async function loadCrewTaste(crewId: string, abspann?: { tmdb_id: number; genre_ids: number[]; tags: string[] }[]): Promise<Taste> {
  const [rows, ratings] = await Promise.all([
    abspann
      ? Promise.resolve(abspann)
      : db().selectFrom("abspann").select(["tmdb_id", "genre_ids", "tags"]).where("crew_id", "=", crewId).limit(2000).execute(),
    crewRatings(crewId),
  ]);
  if (!ratings.size) return EMPTY_TASTE;
  return crewTaste(
    rows.map((r) => ({ genreIds: r.genre_ids ?? [], tags: r.tags ?? [], stars: (ratings.get(r.tmdb_id) ?? []).map((x) => x.stars) })),
  );
}
