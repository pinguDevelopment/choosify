import "server-only";
import { countAll, db, upsert } from "./db";
import { AppError } from "./http";
import { discover, getMovie, getMovieDetails, posterUrl, type MovieDetails } from "./tmdb";
import { BUCKETS, BUCKET_MAX_PAGE, mixBuckets, releaseYear, type Choice, type TmdbMovie } from "../candidates";
import { genreNames, movieTags, tagLabel } from "../tags";
import { EMPTY_TASTE, personalTaste, tasteSummary, type Taste } from "../taste";
import type { Locale } from "../i18n/config";

// „Train my Algorithm“: Angemeldete swipen allein durch Filme. Die Stimmen gehören dem Konto
// und fließen in Gruppenrunden in die Filmauswahl ein (siehe startVoting in rooms.ts).

/** Höchstens so viele Trainings-Stimmen pro Konto (Missbrauchsschutz). */
export const MAX_TRAINING_VOTES = 3000;
/** Für den Geschmack zählen die neuesten so vielen Stimmen. */
const TASTE_WINDOW = 1500;
/** Filme pro Stapel. */
const BATCH = 20;

const CHOICE_TO_DB: Record<Choice, number> = { yes: 1, maybe: 0, no: -1 };
const DB_TO_CHOICE: Record<number, Choice> = { 1: "yes", 0: "maybe", [-1]: "no" };

/** Persönlicher Geschmack eines Kontos (leer, wenn nichts trainiert). */
export async function loadPersonalTaste(accountId: string): Promise<Taste> {
  const rows = await db()
    .selectFrom("training_votes")
    .select(["tmdb_id", "choice", "genre_ids", "tags"])
    .where("account_id", "=", accountId)
    .orderBy("voted_at", "desc")
    .limit(TASTE_WINDOW)
    .execute();
  if (!rows.length) return EMPTY_TASTE;
  return personalTaste(rows.map((r) => ({ tmdbId: r.tmdb_id, choice: r.choice, genreIds: r.genre_ids ?? [], tags: r.tags ?? [] })));
}

// Kurzer Zwischenspeicher pro Server-Instanz: Die Runde fragt alle paar Sekunden ihren Zustand ab,
// der Geschmack ändert sich währenddessen kaum.
const cache = new Map<string, { taste: Taste; at: number }>();
const CACHE_MS = 60_000;

/**
 * Geschmack der angemeldeten Personen einer Runde, die das Training in Gruppen erlauben.
 * Konten ohne Training oder mit ausgeschaltetem Schalter fehlen in der Liste.
 */
export async function groupTastes(accountIds: (string | null)[]): Promise<Map<string, Taste>> {
  const ids = [...new Set(accountIds.filter((id): id is string => !!id))];
  const out = new Map<string, Taste>();
  if (!ids.length) return out;
  const allowed = await db().selectFrom("accounts").select("id").where("id", "in", ids).where("use_training", "=", true).execute();
  await Promise.all(
    allowed.map(async ({ id }) => {
      const hit = cache.get(id);
      const taste = hit && Date.now() - hit.at < CACHE_MS ? hit.taste : await loadPersonalTaste(id);
      cache.set(id, { taste, at: Date.now() });
      if (taste.rated) out.set(id, taste);
    }),
  );
  if (cache.size > 500) cache.clear();
  return out;
}

/** Übersicht für die Trainings-Seite: Anzahl, was gelernt wurde, Schalter und die letzten Stimmen. */
export async function trainingProfile(accountId: string, locale: Locale) {
  const [count, account, recent, taste] = await Promise.all([
    db().selectFrom("training_votes").select(countAll()).where("account_id", "=", accountId).executeTakeFirst(),
    db().selectFrom("accounts").select("use_training").where("id", "=", accountId).executeTakeFirst(),
    db()
      .selectFrom("training_votes")
      .select(["tmdb_id", "choice", "title", "title_en", "poster_path", "release_year"])
      .where("account_id", "=", accountId)
      .orderBy("voted_at", "desc")
      .limit(10)
      .execute(),
    loadPersonalTaste(accountId),
  ]);
  return {
    count: Number(count?.n ?? 0),
    max: MAX_TRAINING_VOTES,
    useInGroups: account?.use_training ?? true,
    taste: tasteSummary(taste, 5, 0.15, locale),
    recent: recent.map((r) => ({
      tmdbId: r.tmdb_id,
      title: (locale === "en" && r.title_en) || r.title,
      poster: posterUrl(r.poster_path, "w92"),
      year: r.release_year,
      choice: DB_TO_CHOICE[r.choice],
    })),
  };
}

/**
 * Neue Filme zum Trainieren: bunt gemischt aus allen vier Töpfen und zufälligen Seiten, ohne
 * Dienst-Filter (es geht um den Geschmack, nicht darum, wo der Film gerade läuft).
 * Schon trainierte Filme und die, die der Browser gerade im Stapel hat, kommen nicht nochmal.
 */
export async function trainingBatch(accountId: string, locale: Locale, exclude: number[], rnd: () => number = Math.random) {
  const done = await db().selectFrom("training_votes").select("tmdb_id").where("account_id", "=", accountId).execute();
  const skip = new Set([...done.map((r) => r.tmdb_id), ...exclude]);
  const base = { region: "DE", providerIds: [], genreIds: [] };

  let picked: TmdbMovie[] = [];
  // Wer schon viel trainiert hat, landet öfter auf bekannten Seiten: dann nochmal mit anderen Seiten.
  for (let attempt = 0; attempt < 3 && picked.length < BATCH / 2; attempt++) {
    const lists = await Promise.all(
      BUCKETS.map(async (bucket) => {
        const page = 1 + Math.floor(rnd() * BUCKET_MAX_PAGE[bucket] * 3);
        try {
          let res = await discover({ ...base, bucket, page });
          if (!res.results.length && page > 1) res = await discover({ ...base, bucket, page: 1 + Math.floor(rnd() * Math.min(res.totalPages, 500)) });
          return res.results.filter((m) => !skip.has(m.id));
        } catch {
          return [];
        }
      }),
    );
    const fresh = mixBuckets(lists, BATCH - picked.length);
    for (const m of fresh) skip.add(m.id);
    picked = [...picked, ...fresh];
  }

  const withDetails = await Promise.all(
    picked.map(async (m) => {
      const details: MovieDetails | null = await getMovieDetails(m.id, "DE").catch(() => null);
      return { m, details };
    }),
  );
  return withDetails.map(({ m, details }) => {
    const year = releaseYear(m.release_date);
    const title = (locale === "en" && details?.en.title) || m.title;
    const overview = (locale === "en" && details?.en.overview) || m.overview || null;
    const genreIds = m.genre_ids ?? [];
    return {
      tmdbId: m.id,
      title,
      overview,
      poster: posterUrl(m.poster_path, "w500"),
      year,
      rating: m.vote_average != null ? Math.round(m.vote_average * 10) / 10 : null,
      genreIds,
      genres: genreNames(genreIds, 3, locale),
      tags: movieTags({ genreIds, keywords: details?.keywords, year, rating: m.vote_average }).map((t) => tagLabel(t, locale)),
      runtime: details?.runtime ?? null,
    };
  });
}

/** Stimme speichern (null = zurücknehmen). Filmdaten holt der Server selbst bei TMDB. */
export async function saveTrainingVote(accountId: string, tmdbId: number, choice: Choice | null) {
  if (choice === null) {
    await db().deleteFrom("training_votes").where("account_id", "=", accountId).where("tmdb_id", "=", tmdbId).execute();
    cache.delete(accountId);
    return;
  }
  const [count, existing] = await Promise.all([
    db().selectFrom("training_votes").select(countAll()).where("account_id", "=", accountId).executeTakeFirst(),
    db().selectFrom("training_votes").select("tmdb_id").where("account_id", "=", accountId).where("tmdb_id", "=", tmdbId).executeTakeFirst(),
  ]);
  if (!existing && Number(count?.n ?? 0) >= MAX_TRAINING_VOTES) {
    throw new AppError(409, "Du hast schon sehr viele Filme bewertet. Setz das Training zurück, um neu anzufangen.");
  }
  let m: TmdbMovie;
  try {
    m = await getMovie(tmdbId);
  } catch {
    throw new AppError(400, "Unbekannter Film");
  }
  const details = await getMovieDetails(m.id, "DE").catch(() => null);
  const year = releaseYear(m.release_date);
  await upsert(
    "training_votes",
    {
      account_id: accountId,
      tmdb_id: m.id,
      choice: CHOICE_TO_DB[choice],
      title: m.title.slice(0, 300) || "?",
      title_en: details?.en.title?.slice(0, 300) ?? null,
      poster_path: m.poster_path ?? null,
      release_year: year,
      genre_ids: (m.genre_ids ?? []).slice(0, 20),
      tags: movieTags({ genreIds: m.genre_ids, keywords: details?.keywords, year, rating: m.vote_average }).slice(0, 6),
      voted_at: new Date().toISOString(),
    },
    ["account_id", "tmdb_id"],
  );
  cache.delete(accountId);
}

export async function resetTraining(accountId: string) {
  await db().deleteFrom("training_votes").where("account_id", "=", accountId).execute();
  cache.delete(accountId);
}

export async function setUseTraining(accountId: string, on: boolean) {
  await db().updateTable("accounts").set({ use_training: on }).where("id", "=", accountId).execute();
  cache.delete(accountId);
}
