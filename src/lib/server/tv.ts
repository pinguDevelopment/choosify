import "server-only";
import { db } from "./db";
import { env } from "./env";
import { AppError } from "./http";
import { localized } from "./rooms";
import type { Locale } from "../i18n/config";
import { posterUrl } from "./tmdb";
import { hashSecret, newPairCode, newSecret } from "./tokens";
import type { Participant, Room } from "./session";

// Fernseher koppeln: Der Fernseher öffnet /tv und zeigt einen kurzen Code. Der Host tippt ihn
// in der Lobby ein, danach zeigt der Fernseher von selbst den QR-Code dieser Runde.
// Der Fernseher bekommt dazu ein eigenes Geheimnis (nur im localStorage des Fernsehers, in der DB
// nur als HMAC). Damit fragt er nach, ob er schon gekoppelt ist. Der kurze Code taugt nur zum
// einmaligen Koppeln und läuft nach 15 Minuten ab.

/** So lange gilt ein Code auf dem Fernseher, danach holt er sich einen neuen. */
export const PAIR_MINUTES = 15;

/** Neuen Kopplungscode für einen Fernseher anlegen. */
export async function createPairing(): Promise<{ code: string; secret: string; expiresAt: string }> {
  // Abgelaufene Kopplungen aufräumen, damit ihre Codes wieder frei sind
  const { error: cErr } = await db().from("tv_pairings").delete().lt("expires_at", new Date().toISOString());
  if (cErr) throw cErr;
  const secret = newSecret();
  const expiresAt = new Date(Date.now() + PAIR_MINUTES * 60_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairCode();
    const { error } = await db()
      .from("tv_pairings")
      .insert({ code, secret_hash: hashSecret(secret, env().APP_SECRET), expires_at: expiresAt });
    if (!error) return { code, secret, expiresAt };
    if (error.code !== "23505") throw error; // 23505: Code gerade vergeben, neuen würfeln
  }
  throw new AppError(503, "Gerade ist viel los, bitte gleich nochmal versuchen");
}

/**
 * Fragt der Fernseher, ob er schon gekoppelt ist: gibt den Code der Runde zurück (oder null).
 * Unbekannt oder abgelaufen: null, dann holt sich der Fernseher einen neuen Code.
 */
export async function pairingStatus(secret: string): Promise<{ code: string; roomCode: string | null; expiresAt: string } | null> {
  const { data, error } = await db()
    .from("tv_pairings")
    .select("code, expires_at, rooms(code, expires_at)")
    .eq("secret_hash", hashSecret(secret, env().APP_SECRET))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const room = (Array.isArray(data.rooms) ? data.rooms[0] : data.rooms) as { code: string; expires_at: string } | null;
  const roomCode = room && room.expires_at > new Date().toISOString() ? room.code : null;
  return { code: data.code, roomCode, expiresAt: data.expires_at };
}

/** Host gibt den Code vom Fernseher ein: Der Fernseher zeigt ab jetzt diese Runde. */
export async function linkPairing(room: Room, me: Participant, code: string): Promise<void> {
  if (!me.is_host) throw new AppError(403, "Nur der Host kann den Fernseher verbinden");
  const now = new Date().toISOString();
  // Nur ein noch freier, gültiger Code. Danach gilt die Kopplung so lange wie die Runde.
  const { data, error } = await db()
    .from("tv_pairings")
    .update({ room_id: room.id, linked_at: now, expires_at: room.expires_at })
    .eq("code", code)
    .is("room_id", null)
    .gt("expires_at", now)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError(404, "Diesen Code gibt es nicht (mehr). Schau nochmal auf den Fernseher.");
}

/**
 * Was der Fernseher zeigt: Wer da ist, wie weit das Swipen ist, und am Ende der Gewinner.
 * Öffentlich mit dem Raum-Code (den zeigt der QR-Code ohnehin), deshalb keine Stimmen
 * und keine Rangliste, nur Fortschritt.
 */
export async function tvRoomState(room: Room, locale: Locale = "de") {
  const [{ data: people, error }, { count: movies, error: mErr }, { data: votes, error: vErr }] = await Promise.all([
    db().from("participants").select("id, name, is_host, genres_done").eq("room_id", room.id).order("joined_at"),
    db().from("room_movies").select("tmdb_id", { count: "exact", head: true }).eq("room_id", room.id),
    db().from("votes").select("participant_id").eq("room_id", room.id),
  ]);
  if (error) throw error;
  if (mErr) throw mErr;
  if (vErr) throw vErr;
  const voted = new Map<string, number>();
  for (const v of votes ?? []) voted.set(v.participant_id, (voted.get(v.participant_id) ?? 0) + 1);

  let winner: { title: string; poster: string | null; year: number | null } | null = null;
  if (room.status === "done" && room.winner_tmdb_id) {
    const { data, error: wErr } = await db()
      .from("room_movies")
      .select("title, title_en, poster_path, release_year")
      .eq("room_id", room.id)
      .eq("tmdb_id", room.winner_tmdb_id)
      .maybeSingle();
    if (wErr) throw wErr;
    if (data) winner = { title: localized(data, locale).title, poster: posterUrl(data.poster_path, "w500"), year: data.release_year };
  }

  return {
    code: room.code,
    status: room.status,
    movieCount: movies ?? 0,
    participants: (people ?? []).map((p) => ({
      name: p.name,
      isHost: p.is_host,
      genresDone: p.genres_done,
      voted: voted.get(p.id) ?? 0,
    })),
    runoffCount: room.runoff_ids?.length ?? 0,
    winner,
  };
}
