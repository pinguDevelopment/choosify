import "server-only";
import { randomUUID } from "node:crypto";
import { countAll, db, dialect, isForeignKeyViolation, isLimitViolation, isUniqueViolation, upsert } from "./db";
import { AppError } from "./http";
import { env } from "./env";
import { discover, getMovieDetails, getProviders, posterUrl, type MovieDetails } from "./tmdb";
import { genreNames, movieTags, tagLabel } from "../tags";
import type { Locale } from "../i18n/config";
import { hashSecret, newRoomCode, newSecret } from "./tokens";
import { currentAccount, selectCrew } from "./account";
import { setCrewCookie, setParticipantCookie, currentCrew, type Participant, type Room } from "./session";
import { BUCKETS, NO_YEARS, mixBuckets, pickCandidates, randomPage, releaseYear, personalOrder, streamableOn, type Choice, type TmdbMovie, type YearRange } from "../candidates";
import { rankMovies, runoffResult, tiedLeaders } from "../ranking";
import { averageStars, EMPTY_TASTE, groupBooster, tasteBoost, tasteRerank, tasteSummary, type Taste } from "../taste";
import { crewRatings, loadCrewTaste, rateLink } from "./ratings";
import { groupTastes } from "./training";

export { AppError };

/** So lange gilt eine Runde. */
const ROOM_HOURS = 24;
/** Höchstens so viele Filme im Abspann einer Crew (früher ein Trigger in Postgres). */
const MAX_ABSPANN = 2000;

// ---- Raum erstellen / beitreten ------------------------------------------

export async function createRoom(input: {
  hostName: string;
  region: string;
  providerIds: number[];
  anySource: boolean;
  years?: YearRange;
  crewName?: string;
  locale?: Locale;
}): Promise<{ code: string; id: string }> {
  const app = env().APP_SECRET;

  // Crew des Hosts wiederverwenden oder neu anlegen. Angemeldet gehört sie dem Konto
  // (dann ohne Crew-Cookie, damit auf fremden Geräten nach dem Abmelden nichts zurückbleibt),
  // sonst dem Browser des Hosts.
  let crew = await currentCrew();
  if (!crew) {
    const account = await currentAccount();
    const secret = newSecret();
    const name = input.crewName?.trim() || (input.locale === "en" ? `${input.hostName}’s crew` : `Crew von ${input.hostName}`);
    const id = randomUUID();
    await db()
      .insertInto("crews")
      .values({ id, name, secret_hash: hashSecret(secret, app), account_id: account?.id ?? null })
      .execute();
    crew = { id, name };
    if (account) await selectCrew(id);
    else await setCrewCookie(id, secret);
  } else {
    // Zuletzt benutzte Crew steht auf anderen Geräten vorne.
    await db().updateTable("crews").set({ last_used_at: new Date().toISOString() }).where("id", "=", crew.id).execute();
  }

  return insertRoom({
    crewId: crew!.id,
    region: input.region,
    providerIds: input.providerIds,
    anySource: input.anySource,
    years: input.years,
    hostName: input.hostName,
  });
}

/**
 * Legt die Runde an. Mit hostName tritt der Host gleich bei (Cookie in diesem Browser).
 * Ohne hostName (Runde vom Fernseher) wird die erste Person, die beitritt, zum Host.
 */
export async function insertRoom(input: {
  crewId: string;
  region: string;
  providerIds: number[];
  anySource: boolean;
  years?: YearRange;
  hostName?: string;
}): Promise<{ code: string; id: string }> {
  const years = input.years ?? NO_YEARS;
  await cleanupExpired();
  // Code-Kollisionen sind extrem unwahrscheinlich, trotzdem abfangen.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    const id = randomUUID();
    try {
      await db()
        .insertInto("rooms")
        .values({
          id,
          code,
          crew_id: input.crewId,
          region: input.region,
          provider_ids: input.providerIds,
          any_source: input.anySource,
          year_from: years.from,
          year_to: years.to,
          expires_at: new Date(Date.now() + ROOM_HOURS * 3600_000).toISOString(),
        })
        .execute();
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
    if (!input.hostName) return { code, id };

    const secret = newSecret();
    const account = await currentAccount();
    await db()
      .insertInto("participants")
      .values({
        id: randomUUID(),
        room_id: id,
        name: input.hostName,
        token_hash: hashSecret(secret, env().APP_SECRET),
        is_host: true,
        account_id: account?.id ?? null,
      })
      .execute();
    await setParticipantCookie(code, secret);
    return { code, id };
  }
  throw new Error("Konnte keinen freien Raum-Code finden");
}

export async function joinRoom(room: Room, name: string): Promise<void> {
  if (room.status === "done") throw new AppError(409, "Diese Runde ist schon beendet");
  const people = await db().selectFrom("participants").select(["name", "is_host"]).where("room_id", "=", room.id).execute();
  if (people.length >= 30) throw new AppError(409, "Die Runde ist voll");
  if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new AppError(409, "Dieser Name ist schon vergeben");

  // Runde vom Fernseher hat noch keinen Host: Wer zuerst beitritt, leitet die Runde.
  // Der Unique-Index participants_one_host verhindert zwei Hosts, falls zwei gleichzeitig beitreten:
  // Dann scheitert das Einfügen als Host und die Person kommt als Gast rein.
  const secret = newSecret();
  // Angemeldet: Konto merken, damit der trainierte Geschmack („Train my Algorithm“) mitzählt
  const account = await currentAccount();
  const row = { room_id: room.id, name, token_hash: hashSecret(secret, env().APP_SECRET), account_id: account?.id ?? null };
  const id = randomUUID();
  const insert = (isHost: boolean) => db().insertInto("participants").values({ ...row, id, is_host: isHost }).execute();
  const asHost = !people.some((p) => p.is_host);
  try {
    try {
      await insert(asHost);
    } catch (err) {
      if (!isUniqueViolation(err) || !asHost) throw err;
      await insert(false);
    }
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Dieser Name ist schon vergeben");
    throw err;
  }
  if (asHost) await keepOneHost(room.id);
  await setParticipantCookie(room.code, secret);
}

/**
 * MariaDB kennt keinen Teil-Index für "nur ein Host pro Runde". Sind zwei gleichzeitig als Host
 * hineingekommen, bleibt nur die Person Host, die zuerst beigetreten ist.
 */
async function keepOneHost(roomId: string) {
  const hosts = await db()
    .selectFrom("participants")
    .select("id")
    .where("room_id", "=", roomId)
    .where("is_host", "=", true)
    .orderBy("joined_at")
    .orderBy("id")
    .execute();
  if (hosts.length > 1) {
    await db().updateTable("participants").set({ is_host: false }).where("id", "in", hosts.slice(1).map((h) => h.id)).execute();
  }
}

// ---- Ablauf -----------------------------------------------------------------

export async function setGenres(me: Participant, genreIds: number[]) {
  await db().updateTable("participants").set({ genre_ids: [...new Set(genreIds)], genres_done: true }).where("id", "=", me.id).execute();
}

const ROOM_SIZE = 30;

/**
 * Kandidaten aus vier Töpfen (beliebt, top bewertet, Klassiker, Geheimtipps) mit zufälligen Seiten,
 * abwechselnd gemischt. Danach wird jeder Film einzeln geprüft: Er muss gerade bei einem der
 * gewählten Dienste im Abo, kostenlos oder mit Werbung laufen. Reine Kino- oder Leihfilme fliegen raus.
 *
 * Hat die Crew schon Filme bewertet oder haben Leute aus der Runde ihren Geschmack trainiert
 * („Train my Algorithm“), rücken passende Filme etwas nach vorne (und umgekehrt).
 * Die Mischung bleibt dabei erhalten.
 */
type Booster = ReturnType<typeof groupBooster>;

async function findCandidates(room: Room, genreIds: number[], selections: number[][], watched: number[], boost: Booster) {
  // "Sonstige / eigene Quelle": kein Dienst-Filter und keine Prüfung, nur die Kino-Sperre bleibt.
  // Ohne Auswahl sonst: alle bekannten Dienste, damit trotzdem nur Streambares kommt.
  const providerIds = room.any_source
    ? []
    : room.provider_ids.length
    ? room.provider_ids
    : (await getProviders(room.region)).filter((p) => p.featured).map((p) => p.id);
  const years = { from: room.year_from, to: room.year_to };
  const base = { region: room.region, providerIds, genreIds, years };

  const lists = await Promise.all(
    BUCKETS.map(async (bucket) => {
      const first = await discover({ ...base, bucket, page: 1 });
      const page = randomPage(bucket, first.totalPages);
      const more = page === 1 ? [] : (await discover({ ...base, bucket, page })).results;
      // Zufällige Seite zuerst, damit nicht jede Runde dieselben Filme bringt
      return pickCandidates([...more, ...first.results], selections, watched, ROOM_SIZE, boost ? (m) => boost(m.genre_ids, [], m.id) : undefined);
    }),
  );
  // Pro Film ein Abruf: Verfügbarkeit, Schlagwörter (für die Tags) und Laufzeit
  const withDetails = async (m: TmdbMovie) => {
    try {
      return { ...m, details: await getMovieDetails(m.id, room.region) };
    } catch {
      return { ...m, details: null as MovieDetails | null };
    }
  };
  // Geschmack mit Genres und Tags (die Tags gibt es erst nach dem Detail-Abruf)
  const byTaste = <T extends TmdbMovie & { details: MovieDetails | null }>(list: T[]) =>
    boost
      ? tasteRerank(list, (m) =>
          boost(m.genre_ids, movieTags({ genreIds: m.genre_ids, keywords: m.details?.keywords, year: releaseYear(m.release_date), rating: m.vote_average }), m.id),
        )
      : list;
  if (room.any_source) {
    const mixed = mixBuckets(lists, boost ? Math.round(ROOM_SIZE * 1.3) : ROOM_SIZE);
    return byTaste(await Promise.all(mixed.map(withDetails))).slice(0, ROOM_SIZE);
  }
  const mixed = mixBuckets(lists, Math.round(ROOM_SIZE * 1.6));

  const checked = await Promise.all(mixed.map(withDetails));
  // Ohne Details wissen wir nicht, ob er streambar ist: im Zweifel lieber weglassen
  return byTaste(checked.filter((m) => m.details && streamableOn(m.details.providers, providerIds).length > 0)).slice(0, ROOM_SIZE);
}

/** Host startet das Swipen: Kandidaten aus TMDB holen, Abspann-Filme rausfiltern. */
export async function startVoting(room: Room, me: Participant) {
  if (!me.is_host) throw new AppError(403, "Nur der Host kann starten");
  if (room.status !== "lobby") throw new AppError(409, "Die Runde läuft schon");

  const people = await db().selectFrom("participants").select(["genre_ids", "account_id"]).where("room_id", "=", room.id).execute();
  const selections = people.map((p) => p.genre_ids);
  const genreIds = [...new Set(selections.flat())];

  let watched: number[] = [];
  let taste = EMPTY_TASTE;
  if (room.crew_id) {
    const data = await db().selectFrom("abspann").select(["tmdb_id", "genre_ids", "tags"]).where("crew_id", "=", room.crew_id).execute();
    watched = data.map((r) => r.tmdb_id);
    taste = await loadCrewTaste(room.crew_id, data);
  }
  // Wer angemeldet ist und trainiert hat, bringt seinen Geschmack mit
  const personal = await groupTastes(people.map((p) => p.account_id));
  const boost = groupBooster(taste, [...personal.values()]);

  const picked = await findCandidates(room, genreIds, selections, watched, boost);
  if (picked.length === 0) {
    if (room.year_from != null || room.year_to != null) {
      throw new AppError(422, "Keine passenden Filme gefunden, die gerade im Abo laufen. Wähle mehr Dienste, mehr Genres oder einen größeren Zeitraum.");
    }
    throw new AppError(422, "Keine passenden Filme gefunden, die gerade im Abo laufen. Wähle mehr Dienste oder Genres.");
  }

  const rows = picked.map((m, i) => ({
    room_id: room.id,
    tmdb_id: m.id,
    position: i,
    title: m.title,
    overview: m.overview?.slice(0, 2000) ?? null,
    // Englischer Text aus dem Detail-Abruf; fehlt er, zeigt die englische Oberfläche den deutschen
    title_en: m.details?.en.title ?? null,
    overview_en: m.details?.en.overview ?? null,
    poster_path: m.poster_path ?? null,
    release_year: releaseYear(m.release_date),
    vote_average: m.vote_average != null ? Math.round(m.vote_average * 10) / 10 : null,
    genre_ids: m.genre_ids ?? [],
    runtime_min: m.details?.runtime ?? null,
    tags: movieTags({
      genreIds: m.genre_ids,
      keywords: m.details?.keywords,
      year: releaseYear(m.release_date),
      rating: m.vote_average,
    }),
  }));
  try {
    await db().insertInto("room_movies").values(rows).execute();
  } catch (err) {
    // Doppelter Klick: Die Filme hat der erste Klick schon eingetragen
    if (isUniqueViolation(err)) throw new AppError(409, "Die Runde läuft schon");
    throw err;
  }

  // Nur von lobby -> voting wechseln (schützt vor doppeltem Klick).
  const upd = await db().updateTable("rooms").set({ status: "voting" }).where("id", "=", room.id).where("status", "=", "lobby").executeTakeFirst();
  if (!Number(upd.numUpdatedRows)) throw new AppError(409, "Die Runde läuft schon");
}

const CHOICE_TO_DB: Record<Choice, number> = { yes: 1, maybe: 0, no: -1 };
const DB_TO_CHOICE: Record<number, Choice> = { 1: "yes", 0: "maybe", [-1]: "no" };

export async function vote(room: Room, me: Participant, tmdbId: number, choice: Choice | null) {
  if (room.status !== "voting") throw new AppError(409, "Gerade wird nicht abgestimmt");
  if (choice === null) {
    await db().deleteFrom("votes").where("participant_id", "=", me.id).where("tmdb_id", "=", tmdbId).execute();
    return;
  }
  try {
    await upsert(
      "votes",
      { room_id: room.id, participant_id: me.id, tmdb_id: tmdbId, choice: CHOICE_TO_DB[choice], voted_at: new Date().toISOString() },
      ["participant_id", "tmdb_id"],
    );
  } catch (err) {
    // FK-Fehler = Film gehört nicht zu diesem Raum
    if (isForeignKeyViolation(err)) throw new AppError(400, "Unbekannter Film");
    throw err;
  }
}

/**
 * Host beendet die Abstimmung. Es gibt immer genau einen Gewinner:
 * Liegen vorne mehrere Filme gleichauf, startet zuerst eine Stichwahl zwischen ihnen.
 * Während der Stichwahl beendet derselbe Knopf die Stichwahl vorzeitig.
 */
export async function finish(room: Room, me: Participant, addToAbspann: boolean): Promise<{ runoff: boolean }> {
  if (!me.is_host) throw new AppError(403, "Nur der Host kann beenden");
  if (room.status === "runoff") {
    await resolveRunoff(room);
    return { runoff: false };
  }
  if (room.status !== "voting") throw new AppError(409, "Gerade wird nicht abgestimmt");
  const ranking = await loadRanking(room);
  const leaders = tiedLeaders(ranking);
  if (leaders.length > 1) {
    const res = await db()
      .updateTable("rooms")
      .set({ status: "runoff", runoff_ids: leaders.map((r) => r.tmdbId), winner_to_abspann: addToAbspann })
      .where("id", "=", room.id)
      .where("status", "=", "voting")
      .executeTakeFirst();
    if (!Number(res.numUpdatedRows)) throw new AppError(409, "Die Abstimmung ist schon beendet");
    return { runoff: true };
  }
  await complete(room, "voting", ranking[0]?.tmdbId ?? null, addToAbspann);
  return { runoff: false };
}

/** Setzt den Gewinner. Der Status-Filter sorgt dafür, dass das nur einmal passiert. */
async function complete(room: Room, from: Room["status"], winner: number | null, toAbspann: boolean) {
  const res = await db()
    .updateTable("rooms")
    .set({ status: "done", winner_tmdb_id: winner })
    .where("id", "=", room.id)
    .where("status", "=", from)
    .executeTakeFirst();
  if (Number(res.numUpdatedRows) && toAbspann && winner) await addWinnerToAbspann(room, winner);
}

async function resolveRunoff(room: Room) {
  const data = await db().selectFrom("runoff_votes").select("tmdb_id").where("room_id", "=", room.id).execute();
  const { winner } = runoffResult(room.runoff_ids ?? [], data.map((v) => v.tmdb_id));
  await complete(room, "runoff", winner, room.winner_to_abspann);
}

/** Stimme in der Stichwahl: genau ein Film pro Person, änderbar bis zum Ende. */
export async function runoffVote(room: Room, me: Participant, tmdbId: number) {
  if (room.status !== "runoff") throw new AppError(409, "Gerade läuft keine Stichwahl");
  if (!room.runoff_ids?.includes(tmdbId)) throw new AppError(400, "Dieser Film ist nicht in der Stichwahl");
  await upsert(
    "runoff_votes",
    { room_id: room.id, participant_id: me.id, tmdb_id: tmdbId, voted_at: new Date().toISOString() },
    ["room_id", "participant_id"],
  );
  // Haben alle gewählt, steht der Gewinner sofort fest.
  const [p, v] = await Promise.all([
    db().selectFrom("participants").select(countAll()).where("room_id", "=", room.id).executeTakeFirst(),
    db().selectFrom("runoff_votes").select(countAll()).where("room_id", "=", room.id).executeTakeFirst(),
  ]);
  const people = Number(p?.n ?? 0);
  const picks = Number(v?.n ?? 0);
  if (people && picks && picks >= people) await resolveRunoff(room);
}

// ---- Zustand für die Oberfläche -------------------------------------------

export type RankingRow = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
  likes: number;
  maybes: number;
  dislikes: number;
  unanimous: boolean;
  acceptable: boolean;
};

export async function roomState(room: Room, me: Participant | null, locale: Locale = "de") {
  const people = await db()
    .selectFrom("participants")
    .select(["id", "name", "is_host", "genres_done"])
    .where("room_id", "=", room.id)
    .orderBy("joined_at")
    .execute();

  const base = {
    code: room.code,
    status: room.status,
    region: room.region,
    providerIds: room.provider_ids,
    years: { from: room.year_from, to: room.year_to },
    me: me ? { name: me.name, isHost: me.is_host, genresDone: me.genres_done, genreIds: me.genre_ids } : null,
  };
  // Wer nicht beigetreten ist, sieht nur das Nötigste zum Beitreten.
  if (!me) return { ...base, participants: [], movies: [], myVotes: {}, ranking: [], runoff: null, winner: null, rateToken: null };

  const [movies, votes] = await Promise.all([
    roomMovies(room.id),
    db().selectFrom("votes").select(["participant_id", "tmdb_id", "choice"]).where("room_id", "=", room.id).execute(),
  ]);

  const votedCount = new Map<string, number>();
  const myVotes: Record<number, Choice> = {};
  for (const v of votes) {
    votedCount.set(v.participant_id, (votedCount.get(v.participant_id) ?? 0) + 1);
    if (v.participant_id === me.id) myVotes[v.tmdb_id] = DB_TO_CHOICE[v.choice];
  }

  const [runoff, rateToken, mine] = await Promise.all([
    runoffState(room, me),
    winnerRateToken(room),
    room.status === "voting" ? groupTastes([me.account_id]) : Promise.resolve(new Map()),
  ]);
  const myTaste = me.account_id ? mine.get(me.account_id) : undefined;
  const ranking = rankingOf(movies, votes, people.length, locale);

  return {
    ...base,
    participants: people.map((p) => ({
      name: p.name,
      isHost: p.is_host,
      genresDone: p.genres_done,
      voted: votedCount.get(p.id) ?? 0,
    })),
    // Jede Person bekommt eine eigene, gemischte Reihenfolge (fester Seed pro Person),
    // Filme derselben Reihe werden dabei auseinandergezogen. Wer trainiert hat, sieht
    // Filme nach seinem Geschmack etwas früher.
    movies: byOwnTaste(personalOrder(
      movies.map((m) => ({
        tmdbId: m.tmdb_id,
        ...localized(m, locale),
        poster: posterUrl(m.poster_path, "w500"),
        year: m.release_year,
        rating: m.vote_average != null ? Number(m.vote_average) : null,
        genreIds: m.genre_ids,
        genres: genreNames(m.genre_ids, 3, locale),
        // Runden von vor dem Tag-Update haben keine gespeicherten Tags: dann nur aus den Genres
        tags: ((m.tags as string[] | null)?.length
          ? (m.tags as string[])
          : movieTags({ genreIds: m.genre_ids, year: m.release_year, rating: m.vote_average != null ? Number(m.vote_average) : null })
        ).map((t) => tagLabel(t, locale)),
        runtime: m.runtime_min,
      })),
      me.id,
    ), myTaste, new Map(movies.map((m) => [m.tmdb_id, (m.tags as string[] | null) ?? []]))),
    myVotes,
    ranking,
    runoff,
    winner: room.winner_tmdb_id,
    rateToken,
  };
}

/** Eigene Reihenfolge sanft nach dem trainierten Geschmack (stabil, damit beim Neuladen nichts springt). */
function byOwnTaste<T extends { tmdbId: number; genreIds: number[] }>(list: T[], taste: Taste | undefined, tags: Map<number, string[]>): T[] {
  if (!taste?.rated) return list;
  return tasteRerank(list, (m) => tasteBoost(taste, m.genreIds, tags.get(m.tmdbId) ?? [], m.tmdbId), 6);
}

/** Titel und Beschreibung in der gewünschten Sprache, sonst die deutschen von TMDB. */
export function localized(
  m: { title: string; overview?: string | null; title_en?: string | null; overview_en?: string | null },
  locale: Locale,
): { title: string; overview: string | null } {
  if (locale === "en") return { title: m.title_en || m.title, overview: m.overview_en || m.overview || null };
  return { title: m.title, overview: m.overview ?? null };
}

/** Bewertungslink für den Gewinner, sobald er im Abspann der Crew steht. */
async function winnerRateToken(room: Room): Promise<string | null> {
  if (room.status !== "done" || !room.winner_tmdb_id || !room.crew_id) return null;
  const data = await db()
    .selectFrom("abspann")
    .select("tmdb_id")
    .where("crew_id", "=", room.crew_id)
    .where("tmdb_id", "=", room.winner_tmdb_id)
    .executeTakeFirst();
  return data ? rateLink(room.crew_id, room.winner_tmdb_id) : null;
}

function roomMovies(roomId: string) {
  return db()
    .selectFrom("room_movies")
    .select(["tmdb_id", "position", "title", "overview", "title_en", "overview_en", "poster_path", "release_year", "vote_average", "genre_ids", "runtime_min", "tags"])
    .where("room_id", "=", roomId)
    .orderBy("position")
    .execute();
}

type MovieRow = Awaited<ReturnType<typeof roomMovies>>[number];

/** Rangliste aus Filmen und Stimmen (gleich für alle Datenbanken, siehe rankMovies). */
function rankingOf(movies: MovieRow[], votes: { tmdb_id: number; choice: number }[], participants: number, locale: Locale): RankingRow[] {
  const ranked = rankMovies(
    movies.map((m) => ({ ...m, tmdbId: m.tmdb_id, voteAverage: m.vote_average != null ? Number(m.vote_average) : null })),
    votes.map((v) => ({ tmdbId: v.tmdb_id, choice: v.choice })),
    participants,
  );
  return ranked.map((r) => ({
    tmdbId: r.movie.tmdb_id,
    title: localized(r.movie, locale).title,
    poster: posterUrl(r.movie.poster_path),
    year: r.movie.release_year ?? null,
    rating: r.movie.voteAverage,
    likes: r.likes,
    maybes: r.maybes,
    dislikes: r.dislikes,
    unanimous: r.unanimous,
    acceptable: r.acceptable,
  }));
}

async function loadRanking(room: Room): Promise<RankingRow[]> {
  const [movies, votes, people] = await Promise.all([
    roomMovies(room.id),
    db().selectFrom("votes").select(["tmdb_id", "choice"]).where("room_id", "=", room.id).execute(),
    db().selectFrom("participants").select(countAll()).where("room_id", "=", room.id).executeTakeFirst(),
  ]);
  return rankingOf(movies, votes, Number(people?.n ?? 0), "de");
}

/** Stichwahl: während sie läuft, bleibt der Zwischenstand geheim (kein Mitläufer-Effekt). */
async function runoffState(room: Room, me: Participant) {
  if (!room.runoff_ids?.length) return null;
  const picks = await db().selectFrom("runoff_votes").select(["participant_id", "tmdb_id"]).where("room_id", "=", room.id).execute();
  const result = runoffResult(room.runoff_ids, picks.map((v) => v.tmdb_id));
  return {
    tmdbIds: room.runoff_ids,
    myPick: picks.find((v) => v.participant_id === me.id)?.tmdb_id ?? null,
    votes: picks.length,
    tally: room.status === "done" ? result.tally : null,
    decidedByRating: room.status === "done" ? result.stillTied : false,
  };
}

export type RoomState = Awaited<ReturnType<typeof roomState>>;

// ---- Abspann ----------------------------------------------------------------

export async function listAbspann(crewId: string, locale: Locale = "de") {
  const [rows, ratings] = await Promise.all([
    db()
      .selectFrom("abspann")
      .select(["tmdb_id", "title", "title_en", "poster_path", "release_year", "watched_at", "genre_ids", "tags"])
      .where("crew_id", "=", crewId)
      .orderBy("watched_at", "desc")
      .limit(500)
      .execute(),
    crewRatings(crewId),
  ]);
  const taste = await loadCrewTaste(crewId, rows);
  return {
    taste: { rated: taste.rated, ...tasteSummary(taste, 4, 0.2, locale) },
    movies: rows.map((r) => {
      const list = ratings.get(r.tmdb_id) ?? [];
      return {
        tmdbId: r.tmdb_id,
        title: localized(r, locale).title,
        poster: posterUrl(r.poster_path, "w92"),
        year: r.release_year,
        watchedAt: r.watched_at,
        average: averageStars(list.map((x) => x.stars)),
        ratings: list,
        rateToken: rateLink(crewId, r.tmdb_id),
      };
    }),
  };
}

export async function addAbspann(
  crewId: string,
  m: { tmdbId: number; title: string; titleEn: string | null; posterPath: string | null; year: number | null; genreIds: number[]; tags: string[] },
) {
  const [{ n }, existing] = await Promise.all([
    db().selectFrom("abspann").select(countAll()).where("crew_id", "=", crewId).executeTakeFirstOrThrow(),
    db().selectFrom("abspann").select("tmdb_id").where("crew_id", "=", crewId).where("tmdb_id", "=", m.tmdbId).executeTakeFirst(),
  ]);
  if (!existing && Number(n) >= MAX_ABSPANN) throw new AppError(409, "Die Watchlist ist voll");
  try {
    await upsert(
      "abspann",
      {
        crew_id: crewId,
        tmdb_id: m.tmdbId,
        title: m.title,
        title_en: m.titleEn,
        poster_path: m.posterPath,
        release_year: m.year,
        genre_ids: m.genreIds.slice(0, 20),
        tags: m.tags.slice(0, 6),
      },
      ["crew_id", "tmdb_id"],
    );
  } catch (err) {
    if (isLimitViolation(err)) throw new AppError(409, "Die Watchlist ist voll");
    throw err;
  }
}

export async function removeAbspann(crewId: string, tmdbId: number) {
  await db().deleteFrom("abspann").where("crew_id", "=", crewId).where("tmdb_id", "=", tmdbId).execute();
}

/** Gewinner einer Runde in den Abspann übernehmen (Daten aus dem Raum, nicht vom Client). */
export async function addWinnerToAbspann(room: Room, tmdbId: number) {
  if (!room.crew_id) return;
  const data = await db()
    .selectFrom("room_movies")
    .select(["tmdb_id", "title", "title_en", "poster_path", "release_year", "genre_ids", "tags"])
    .where("room_id", "=", room.id)
    .where("tmdb_id", "=", tmdbId)
    .executeTakeFirst();
  if (!data) throw new AppError(400, "Unbekannter Film");
  await addAbspann(room.crew_id, {
    tmdbId: data.tmdb_id,
    title: data.title,
    titleEn: data.title_en,
    posterPath: data.poster_path,
    year: data.release_year,
    genreIds: data.genre_ids ?? [],
    tags: data.tags ?? [],
  });
}

// ---- Aufräumen ---------------------------------------------------------------

let lastCleanup = 0;

/**
 * Abgelaufene Runden, alte Limit-Zähler, Sitzungen und Fernseher-Codes löschen.
 * Mit Supabase macht das pg_cron stündlich. Bei MariaDB/SQLite erledigt es die App selbst,
 * höchstens einmal pro Stunde, beim Erstellen einer Runde.
 */
export async function cleanupExpired(): Promise<void> {
  if (dialect() === "postgres" || Date.now() - lastCleanup < 3600_000) return;
  lastCleanup = Date.now();
  const now = new Date().toISOString();
  try {
    await db().deleteFrom("rooms").where("expires_at", "<", now).execute();
    await db().deleteFrom("tv_pairings").where("expires_at", "<", now).execute();
    await db().deleteFrom("account_sessions").where("expires_at", "<", now).execute();
    await db().deleteFrom("rate_limits").where("updated_at", "<", new Date(Date.now() - 3600_000).toISOString()).execute();
  } catch (err) {
    console.error("Aufräumen fehlgeschlagen:", err);
  }
}
