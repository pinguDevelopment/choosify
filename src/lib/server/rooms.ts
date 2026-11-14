import "server-only";
import { db } from "./db";
import { AppError } from "./http";
import { env } from "./env";
import { discover, posterUrl } from "./tmdb";
import { hashSecret, newRoomCode, newSecret } from "./tokens";
import { setCrewCookie, setParticipantCookie, currentCrew, type Participant, type Room } from "./session";
import { pickCandidates, releaseYear } from "../candidates";

export { AppError };

const PG_UNIQUE = "23505";

// ---- Raum erstellen / beitreten ------------------------------------------

export async function createRoom(input: {
  hostName: string;
  region: string;
  providerIds: number[];
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
      .insert({ code, crew_id: crew!.id, region: input.region, provider_ids: input.providerIds })
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

  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      discover({ region: room.region, providerIds: room.provider_ids, genreIds, page }),
    ),
  );
  const picked = pickCandidates(pages.flat(), selections, watched, 30);
  if (picked.length === 0) {
    throw new AppError(422, "Keine passenden Filme gefunden. Wähle mehr Anbieter oder Genres.");
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

export async function vote(room: Room, me: Participant, tmdbId: number, liked: boolean | null) {
  if (room.status !== "voting") throw new AppError(409, "Gerade wird nicht abgestimmt");
  if (liked === null) {
    const { error } = await db().from("votes").delete().eq("participant_id", me.id).eq("tmdb_id", tmdbId);
    if (error) throw error;
    return;
  }
  const { error } = await db()
    .from("votes")
    .upsert({ room_id: room.id, participant_id: me.id, tmdb_id: tmdbId, liked, voted_at: new Date().toISOString() });
  // FK-Fehler = Film gehört nicht zu diesem Raum
  if (error?.code === "23503") throw new AppError(400, "Unbekannter Film");
  if (error) throw error;
}

export async function finish(room: Room, me: Participant, winnerTmdbId: number | null) {
  if (!me.is_host) throw new AppError(403, "Nur der Host kann beenden");
  if (room.status !== "voting") throw new AppError(409, "Gerade wird nicht abgestimmt");
  const { error } = await db()
    .from("rooms")
    .update({ status: "done", winner_tmdb_id: winnerTmdbId })
    .eq("id", room.id);
  if (error) throw error;
}

// ---- Zustand für die Oberfläche -------------------------------------------

export type RankingRow = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
  likes: number;
  dislikes: number;
  unanimous: boolean;
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
  if (!me) return { ...base, participants: [], movies: [], myVotes: {}, ranking: [], winner: null };

  const [{ data: movies, error: mErr }, { data: votes, error: vErr }] = await Promise.all([
    db()
      .from("room_movies")
      .select("tmdb_id, title, overview, poster_path, release_year, vote_average, genre_ids")
      .eq("room_id", room.id)
      .order("position"),
    db().from("votes").select("participant_id, tmdb_id, liked").eq("room_id", room.id),
  ]);
  if (mErr) throw mErr;
  if (vErr) throw vErr;

  const votedCount = new Map<string, number>();
  const myVotes: Record<number, boolean> = {};
  for (const v of votes ?? []) {
    votedCount.set(v.participant_id, (votedCount.get(v.participant_id) ?? 0) + 1);
    if (v.participant_id === me.id) myVotes[v.tmdb_id] = v.liked;
  }

  const { data: rank, error: rErr } = await db().rpc("room_ranking", { p_room_id: room.id });
  if (rErr) throw rErr;
  const ranking: RankingRow[] = (rank ?? []).map((r: Record<string, unknown>) => ({
    tmdbId: r.tmdb_id as number,
    title: r.title as string,
    poster: posterUrl(r.poster_path as string | null),
    year: (r.release_year as number | null) ?? null,
    rating: r.vote_average != null ? Number(r.vote_average) : null,
    likes: r.likes as number,
    dislikes: r.dislikes as number,
    unanimous: r.unanimous as boolean,
  }));

  return {
    ...base,
    participants: (people ?? []).map((p) => ({
      name: p.name,
      isHost: p.is_host,
      genresDone: p.genres_done,
      voted: votedCount.get(p.id) ?? 0,
    })),
    movies: (movies ?? []).map((m) => ({
      tmdbId: m.tmdb_id,
      title: m.title,
      overview: m.overview,
      poster: posterUrl(m.poster_path, "w500"),
      year: m.release_year,
      rating: m.vote_average != null ? Number(m.vote_average) : null,
      genreIds: m.genre_ids,
    })),
    myVotes,
    ranking,
    winner: room.winner_tmdb_id,
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
