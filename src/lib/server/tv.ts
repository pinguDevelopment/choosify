import "server-only";
import { randomUUID } from "node:crypto";
import { countAll, db, isUniqueViolation } from "./db";
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
  await db().deleteFrom("tv_pairings").where("expires_at", "<", new Date().toISOString()).execute();
  const secret = newSecret();
  const expiresAt = new Date(Date.now() + PAIR_MINUTES * 60_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairCode();
    try {
      await db()
        .insertInto("tv_pairings")
        .values({ id: randomUUID(), code, secret_hash: hashSecret(secret, env().APP_SECRET), expires_at: expiresAt })
        .execute();
      return { code, secret, expiresAt };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // Code gerade vergeben, neuen würfeln
    }
  }
  throw new AppError(503, "Gerade ist viel los, bitte gleich nochmal versuchen");
}

/**
 * Fragt der Fernseher, ob er schon gekoppelt ist: gibt den Code der Runde zurück (oder null).
 * Unbekannt oder abgelaufen: null, dann holt sich der Fernseher einen neuen Code.
 */
export async function pairingStatus(secret: string): Promise<{ code: string; roomCode: string | null; expiresAt: string } | null> {
  const data = await db()
    .selectFrom("tv_pairings as t")
    .leftJoin("rooms as r", "r.id", "t.room_id")
    .select(["t.code", "t.expires_at", "r.code as room_code", "r.expires_at as room_expires_at"])
    .where("t.secret_hash", "=", hashSecret(secret, env().APP_SECRET))
    .where("t.expires_at", ">", new Date().toISOString())
    .executeTakeFirst();
  if (!data) return null;
  // room_expires_at ist ein Alias, deshalb hier selbst vergleichen (als Zeitpunkt, nicht als Text)
  const roomCode = data.room_code && data.room_expires_at && Date.parse(String(data.room_expires_at)) > Date.now() ? data.room_code : null;
  return { code: data.code, roomCode, expiresAt: data.expires_at };
}

/** Host gibt den Code vom Fernseher ein: Der Fernseher zeigt ab jetzt diese Runde. */
export async function linkPairing(room: Room, me: Participant, code: string): Promise<void> {
  if (!me.is_host) throw new AppError(403, "Nur der Host kann den Fernseher verbinden");
  const now = new Date().toISOString();
  // Nur ein noch freier, gültiger Code. Danach gilt die Kopplung so lange wie die Runde.
  const res = await db()
    .updateTable("tv_pairings")
    .set({ room_id: room.id, linked_at: now, expires_at: room.expires_at })
    .where("code", "=", code)
    .where("room_id", "is", null)
    .where("expires_at", ">", now)
    .executeTakeFirst();
  if (!Number(res.numUpdatedRows)) throw new AppError(404, "Diesen Code gibt es nicht (mehr). Schau nochmal auf den Fernseher.");
}

/**
 * Was der Fernseher zeigt: Wer da ist, wie weit das Swipen ist, und am Ende der Gewinner.
 * Öffentlich mit dem Raum-Code (den zeigt der QR-Code ohnehin), deshalb keine Stimmen
 * und keine Rangliste, nur Fortschritt.
 */
export async function tvRoomState(room: Room, locale: Locale = "de") {
  const [people, movieCount, votes] = await Promise.all([
    db().selectFrom("participants").select(["id", "name", "is_host", "genres_done"]).where("room_id", "=", room.id).orderBy("joined_at").execute(),
    db().selectFrom("room_movies").select(countAll()).where("room_id", "=", room.id).executeTakeFirst(),
    db().selectFrom("votes").select("participant_id").where("room_id", "=", room.id).execute(),
  ]);
  const movies = Number(movieCount?.n ?? 0);
  const voted = new Map<string, number>();
  for (const v of votes) voted.set(v.participant_id, (voted.get(v.participant_id) ?? 0) + 1);

  let winner: { title: string; poster: string | null; year: number | null } | null = null;
  if (room.status === "done" && room.winner_tmdb_id) {
    const data = await db()
      .selectFrom("room_movies")
      .select(["title", "title_en", "poster_path", "release_year"])
      .where("room_id", "=", room.id)
      .where("tmdb_id", "=", room.winner_tmdb_id)
      .executeTakeFirst();
    if (data) winner = { title: localized(data, locale).title, poster: posterUrl(data.poster_path, "w500"), year: data.release_year };
  }

  return {
    code: room.code,
    status: room.status,
    movieCount: movies,
    participants: people.map((p) => ({
      name: p.name,
      isHost: p.is_host,
      genresDone: p.genres_done,
      voted: voted.get(p.id) ?? 0,
    })),
    runoffCount: room.runoff_ids?.length ?? 0,
    winner,
  };
}
