import "server-only";
import { db } from "./db";
import { AppError } from "./http";
import { env } from "./env";
import { discover, getMovieDetails, getProviders, posterUrl, type MovieDetails } from "./tmdb";
import { genreNames, movieTags } from "../tags";
import { hashSecret, newRoomCode, newSecret } from "./tokens";
import { setCrewCookie, setParticipantCookie, currentCrew, type Participant, type Room } from "./session";
import { BUCKETS, mixBuckets, pickCandidates, randomPage, releaseYear, personalOrder, streamableOn, type Choice, type TmdbMovie } from "../candidates";
import { runoffResult, tiedLeaders } from "../ranking";

export { AppError };

const PG_UNIQUE = "23505";

// ---- Raum erstellen / beitreten ------------------------------------------

export async function createRoom(input: {
  hostName: string;
  region: string;
  providerIds: number[];
  anySource: boolean;
  crewName?: string;
}): Promise<{ code: string }> {
  const app = env().APP_SECRET;

  // Crew des Hosts wiederverwenden oder neu anlegen (gehört zum Browser des Hosts).
  let crew = await currentCrew();
  if (!crew) {
    const secret = newSecret();
    const name = input.crewName?.trim() || `Crew von ${input.hostName}`;
    const { data, error } = await db()
      .from("crews")
      .insert({ name, secret_hash: hashSecret(secret, app) })
      .select("id, name")
      .single();
    if (error) throw error;
    crew = data;
    await setCrewCookie(data.id, secret);
  }

  // Code-Kollisionen sind extrem unwahrscheinlich, trotzdem abfangen.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    const { data: room, error } = await db()
      .from("rooms")
      .insert({ code, crew_id: crew!.id, region: input.region, provider_ids: input.providerIds, any_source: input.anySource })
      .select("id")
      .single();
    if (error?.code === PG_UNIQUE) continue;
    if (error) throw error;

    const secret = newSecret();
    const { error: pErr } = await db().from("participants").insert({
      room_id: room.id,
      name: input.hostName,
      token_hash: hashSecret(secret, app),
      is_host: true,
    });
    if (pErr) throw pErr;
    await setParticipantCookie(code, secret);
    return { code };
  }
  throw new Error("Konnte keinen freien Raum-Code finden");
}

export async function joinRoom(room: Room, name: string): Promise<void> {
  if (room.status === "done") throw new AppError(409, "Diese Runde ist schon beendet");
  const { count } = await db()
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) >= 30) throw new AppError(409, "Die Runde ist voll");

  const secret = newSecret();
  const { error } = await db().from("participants").insert({
    room_id: room.id,
    name,
    token_hash: hashSecret(secret, env().APP_SECRET),
  });
  if (error?.code === PG_UNIQUE) throw new AppError(409, "Dieser Name ist schon vergeben");
  if (error) throw error;
  await setParticipantCookie(room.code, secret);
}

// ---- Ablauf -----------------------------------------------------------------

export async function setGenres(me: Participant, genreIds: number[]) {
  const { error } = await db()
    .from("participants")
    .update({ genre_ids: [...new Set(genreIds)], genres_done: true })
    .eq("id", me.id);
  if (error) throw error;
}

const ROOM_SIZE = 30;

/**
 * Kandidaten aus vier Töpfen (beliebt, top bewertet, Klassiker, Geheimtipps) mit zufälligen Seiten,
 * abwechselnd gemischt. Danach wird jeder Film einzeln geprüft: Er muss gerade bei einem der
 * gewählten Dienste im Abo, kostenlos oder mit Werbung laufen. Reine Kino- oder Leihfilme fliegen raus.
 */
async function findCandidates(room: Room, genreIds: number[], selections: number[][], watched: number[]) {
  // "Sonstige / eigene Quelle": kein Dienst-Filter und keine Prüfung, nur die Kino-Sperre bleibt.
  // Ohne Auswahl sonst: alle bekannten Dienste, damit trotzdem nur Streambares kommt.
  const providerIds = room.any_source
    ? []
    : room.provider_ids.length
    ? room.provider_ids
    : (await getProviders(room.region)).filter((p) => p.featured).map((p) => p.id);
  const base = { region: room.region, providerIds, genreIds };

  const lists = await Promise.all(
    BUCKETS.map(async (bucket) => {
      const first = await discover({ ...base, bucket, page: 1 });
      const page = randomPage(bucket, first.totalPages);
      const more = page === 1 ? [] : (await discover({ ...base, bucket, page })).results;
      // Zufällige Seite zuerst, damit nicht jede Runde dieselben Filme bringt
      return pickCandidates([...more, ...first.results], selections, watched, ROOM_SIZE);
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
  if (room.any_source) return Promise.all(mixBuckets(lists, ROOM_SIZE).map(withDetails));
  const mixed = mixBuckets(lists, Math.round(ROOM_SIZE * 1.6));

  const checked = await Promise.all(mixed.map(withDetails));
  // Ohne Details wissen wir nicht, ob er streambar ist: im Zweifel lieber weglassen
  return checked.filter((m) => m.details && streamableOn(m.details.providers, providerIds).length > 0).slice(0, ROOM_SIZE);
}

/** Host startet das Swipen: Kandidaten aus TMDB holen, Abspann-Filme rausfiltern. */
export async function startVoting(room: Room, me: Participant) {
  if (!me.is_host) throw new AppError(403, "Nur der Host kann starten");
  if (room.status !== "lobby") throw new AppError(409, "Die Runde läuft schon");

  const { data: people, error } = await db()
    .from("participants")
    .select("genre_ids")
    .eq("room_id", room.id);
  if (error) throw error;
  const selections = (people ?? []).map((p) => p.genre_ids as number[]);
  const genreIds = [...new Set(selections.flat())];

  let watched: number[] = [];
  if (room.crew_id) {
    const { data, error: aErr } = await db().from("abspann").select("tmdb_id").eq("crew_id", room.crew_id);
    if (aErr) throw aErr;
    watched = (data ?? []).map((r) => r.tmdb_id);
  }

  const picked = await findCandidates(room, genreIds, selections, watched);
  if (picked.length === 0) {
    throw new AppError(422, "Keine passenden Filme gefunden, die gerade im Abo laufen. Wähle mehr Dienste oder Genres.");
  }

  const rows = picked.map((m, i) => ({
    room_id: room.id,
    tmdb_id: m.id,
    position: i,
    title: m.title,
    overview: m.overview?.slice(0, 2000) ?? null,
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
  const { error: mErr } = await db().from("room_movies").insert(rows);
  if (mErr) throw mErr;

  // Nur von lobby -> voting wechseln (schützt vor doppeltem Klick).
  const { data: upd, error: uErr } = await db()
    .from("rooms")
    .update({ status: "voting" })
    .eq("id", room.id)
    .eq("status", "lobby")
    .select("id");
  if (uErr) throw uErr;
  if (!upd?.length) throw new AppError(409, "Die Runde läuft schon");
}

const CHOICE_TO_DB: Record<Choice, number> = { yes: 1, maybe: 0, no: -1 };
const DB_TO_CHOICE: Record<number, Choice> = { 1: "yes", 0: "maybe", [-1]: "no" };

export async function vote(room: Room, me: Participant, tmdbId: number, choice: Choice | null) {
  if (room.status !== "voting") throw new AppError(409, "Gerade wird nicht abgestimmt");
  if (choice === null) {
    const { error } = await db().from("votes").delete().eq("participant_id", me.id).eq("tmdb_id", tmdbId);
    if (error) throw error;
    return;
  }
  const { error } = await db()
    .from("votes")
    .upsert({ room_id: room.id, participant_id: me.id, tmdb_id: tmdbId, choice: CHOICE_TO_DB[choice], voted_at: new Date().toISOString() });
  // FK-Fehler = Film gehört nicht zu diesem Raum
  if (error?.code === "23503") throw new AppError(400, "Unbekannter Film");
  if (error) throw error;
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
  const ranking = await loadRanking(room.id);
  const leaders = tiedLeaders(ranking);
  if (leaders.length > 1) {
    const { data, error } = await db()
      .from("rooms")
      .update({ status: "runoff", runoff_ids: leaders.map((r) => r.tmdbId), winner_to_abspann: addToAbspann })
      .eq("id", room.id)
      .eq("status", "voting")
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new AppError(409, "Die Abstimmung ist schon beendet");
    return { runoff: true };
  }
  await complete(room, "voting", ranking[0]?.tmdbId ?? null, addToAbspann);
  return { runoff: false };
}

/** Setzt den Gewinner. Der Status-Filter sorgt dafür, dass das nur einmal passiert. */
async function complete(room: Room, from: Room["status"], winner: number | null, toAbspann: boolean) {
  const { data, error } = await db()
    .from("rooms")
    .update({ status: "done", winner_tmdb_id: winner })
    .eq("id", room.id)
    .eq("status", from)
    .select("id");
  if (error) throw error;
  if (data?.length && toAbspann && winner) await addWinnerToAbspann(room, winner);
}

async function resolveRunoff(room: Room) {
  const { data, error } = await db().from("runoff_votes").select("tmdb_id").eq("room_id", room.id);
  if (error) throw error;
  const { winner } = runoffResult(room.runoff_ids ?? [], (data ?? []).map((v) => v.tmdb_id));
  await complete(room, "runoff", winner, room.winner_to_abspann);
}

/** Stimme in der Stichwahl: genau ein Film pro Person, änderbar bis zum Ende. */
export async function runoffVote(room: Room, me: Participant, tmdbId: number) {
  if (room.status !== "runoff") throw new AppError(409, "Gerade läuft keine Stichwahl");
  if (!room.runoff_ids?.includes(tmdbId)) throw new AppError(400, "Dieser Film ist nicht in der Stichwahl");
  const { error } = await db()
    .from("runoff_votes")
    .upsert({ room_id: room.id, participant_id: me.id, tmdb_id: tmdbId, voted_at: new Date().toISOString() });
  if (error) throw error;
  // Haben alle gewählt, steht der Gewinner sofort fest.
  const [{ count: people, error: pErr }, { count: picks, error: vErr }] = await Promise.all([
    db().from("participants").select("id", { count: "exact", head: true }).eq("room_id", room.id),
    db().from("runoff_votes").select("participant_id", { count: "exact", head: true }).eq("room_id", room.id),
  ]);
  if (pErr) throw pErr;
  if (vErr) throw vErr;
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

export async function roomState(room: Room, me: Participant | null) {
  const { data: people, error } = await db()
    .from("participants")
    .select("id, name, is_host, genres_done")
    .eq("room_id", room.id)
    .order("joined_at");
  if (error) throw error;

  const base = {
    code: room.code,
    status: room.status,
    region: room.region,
    providerIds: room.provider_ids,
    me: me ? { name: me.name, isHost: me.is_host, genresDone: me.genres_done, genreIds: me.genre_ids } : null,
  };
  // Wer nicht beigetreten ist, sieht nur das Nötigste zum Beitreten.
  if (!me) return { ...base, participants: [], movies: [], myVotes: {}, ranking: [], runoff: null, winner: null };

  const [{ data: movies, error: mErr }, { data: votes, error: vErr }] = await Promise.all([
    db()
      .from("room_movies")
      .select("tmdb_id, title, overview, poster_path, release_year, vote_average, genre_ids, runtime_min, tags")
      .eq("room_id", room.id)
      .order("position"),
    db().from("votes").select("participant_id, tmdb_id, choice").eq("room_id", room.id),
  ]);
  if (mErr) throw mErr;
  if (vErr) throw vErr;

  const votedCount = new Map<string, number>();
  const myVotes: Record<number, Choice> = {};
  for (const v of votes ?? []) {
    votedCount.set(v.participant_id, (votedCount.get(v.participant_id) ?? 0) + 1);
    if (v.participant_id === me.id) myVotes[v.tmdb_id] = DB_TO_CHOICE[v.choice];
  }

  const [ranking, runoff] = await Promise.all([loadRanking(room.id), runoffState(room, me)]);

  return {
    ...base,
    participants: (people ?? []).map((p) => ({
      name: p.name,
      isHost: p.is_host,
      genresDone: p.genres_done,
      voted: votedCount.get(p.id) ?? 0,
    })),
    // Jede Person bekommt eine eigene, gemischte Reihenfolge (fester Seed pro Person),
    // Filme derselben Reihe werden dabei auseinandergezogen.
    movies: personalOrder(
      (movies ?? []).map((m) => ({
        tmdbId: m.tmdb_id,
        title: m.title,
        overview: m.overview,
        poster: posterUrl(m.poster_path, "w500"),
        year: m.release_year,
        rating: m.vote_average != null ? Number(m.vote_average) : null,
        genreIds: m.genre_ids,
        genres: genreNames(m.genre_ids),
        // Runden von vor dem Tag-Update haben keine gespeicherten Tags: dann nur aus den Genres
        tags: (m.tags as string[] | null)?.length
          ? (m.tags as string[])
          : movieTags({ genreIds: m.genre_ids, year: m.release_year, rating: m.vote_average != null ? Number(m.vote_average) : null }),
        runtime: m.runtime_min,
      })),
      me.id,
    ),
    myVotes,
    ranking,
    runoff,
    winner: room.winner_tmdb_id,
  };
}

async function loadRanking(roomId: string): Promise<RankingRow[]> {
  const { data: rank, error } = await db().rpc("room_ranking", { p_room_id: roomId });
  if (error) throw error;
  return (rank ?? []).map((r: Record<string, unknown>) => ({
    tmdbId: r.tmdb_id as number,
    title: r.title as string,
    poster: posterUrl(r.poster_path as string | null),
    year: (r.release_year as number | null) ?? null,
    rating: r.vote_average != null ? Number(r.vote_average) : null,
    likes: r.likes as number,
    maybes: r.maybes as number,
    dislikes: r.dislikes as number,
    unanimous: r.unanimous as boolean,
    acceptable: r.acceptable as boolean,
  }));
}

/** Stichwahl: während sie läuft, bleibt der Zwischenstand geheim (kein Mitläufer-Effekt). */
async function runoffState(room: Room, me: Participant) {
  if (!room.runoff_ids?.length) return null;
  const { data, error } = await db().from("runoff_votes").select("participant_id, tmdb_id").eq("room_id", room.id);
  if (error) throw error;
  const picks = data ?? [];
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

export async function listAbspann(crewId: string) {
  const { data, error } = await db()
    .from("abspann")
    .select("tmdb_id, title, poster_path, release_year, watched_at")
    .eq("crew_id", crewId)
    .order("watched_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    tmdbId: r.tmdb_id,
    title: r.title,
    poster: posterUrl(r.poster_path, "w92"),
    year: r.release_year,
    watchedAt: r.watched_at,
  }));
}

export async function addAbspann(
  crewId: string,
  m: { tmdbId: number; title: string; posterPath: string | null; year: number | null },
) {
  const { error } = await db().from("abspann").upsert({
    crew_id: crewId,
    tmdb_id: m.tmdbId,
    title: m.title,
    poster_path: m.posterPath,
    release_year: m.year,
  });
  if (error?.code === "P0001") throw new AppError(409, "Der Abspann ist voll");
  if (error) throw error;
}

export async function removeAbspann(crewId: string, tmdbId: number) {
  const { error } = await db().from("abspann").delete().eq("crew_id", crewId).eq("tmdb_id", tmdbId);
  if (error) throw error;
}

/** Gewinner einer Runde in den Abspann übernehmen (Daten aus dem Raum, nicht vom Client). */
export async function addWinnerToAbspann(room: Room, tmdbId: number) {
  if (!room.crew_id) return;
  const { data, error } = await db()
    .from("room_movies")
    .select("tmdb_id, title, poster_path, release_year")
    .eq("room_id", room.id)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(400, "Unbekannter Film");
  await addAbspann(room.crew_id, {
    tmdbId: data.tmdb_id,
    title: data.title,
    posterPath: data.poster_path,
    year: data.release_year,
  });
}
