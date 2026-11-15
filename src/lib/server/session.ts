import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";
import { hashSecret, isRoomCode, safeEqualHex } from "./tokens";
import { accountCrews, currentAccount, CREW_SELECT_COOKIE } from "./account";
import { cookieBase as base } from "./cookie-opts";

export const participantCookie = (code: string) => `fa_p_${code}`;
const CREW_COOKIE = "fa_crew";

export async function setParticipantCookie(code: string, secret: string) {
  (await cookies()).set(participantCookie(code), secret, { ...base, maxAge: 60 * 60 * 24 });
}

export async function setCrewCookie(crewId: string, secret: string) {
  (await cookies()).set(CREW_COOKIE, `${crewId}.${secret}`, { ...base, maxAge: 60 * 60 * 24 * 365 });
}

export type Room = {
  id: string;
  code: string;
  crew_id: string | null;
  region: string;
  provider_ids: number[];
  status: "lobby" | "voting" | "runoff" | "done";
  winner_tmdb_id: number | null;
  runoff_ids: number[] | null;
  winner_to_abspann: boolean;
  any_source: boolean;
  /** Erscheinungsjahr von/bis, null = offen */
  year_from: number | null;
  year_to: number | null;
  expires_at: string;
};

export type Participant = {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  genre_ids: number[];
  genres_done: boolean;
};

export async function loadRoom(code: string): Promise<Room | null> {
  if (!isRoomCode(code)) return null;
  const room = await db()
    .selectFrom("rooms")
    .select(["id", "code", "crew_id", "region", "provider_ids", "status", "winner_tmdb_id", "runoff_ids", "winner_to_abspann", "any_source", "year_from", "year_to", "expires_at"])
    .where("code", "=", code)
    .where("expires_at", ">", new Date().toISOString())
    .executeTakeFirst();
  return room ?? null;
}

/** Der aktuelle Teilnehmer in diesem Raum, erkannt am httpOnly-Cookie. */
export async function currentParticipant(room: Room): Promise<Participant | null> {
  const secret = (await cookies()).get(participantCookie(room.code))?.value;
  if (!secret || secret.length > 100) return null;
  const me = await db()
    .selectFrom("participants")
    .select(["id", "room_id", "name", "is_host", "genre_ids", "genres_done"])
    .where("room_id", "=", room.id)
    .where("token_hash", "=", hashSecret(secret, env().APP_SECRET))
    .executeTakeFirst();
  return me ?? null;
}

type DeviceCrew = { id: string; name: string; account_id: string | null };

/** Die Crew aus dem Crew-Cookie dieses Geräts (ohne Konto), oder null. */
export async function deviceCrew(): Promise<DeviceCrew | null> {
  const raw = (await cookies()).get(CREW_COOKIE)?.value;
  if (!raw || raw.length > 200) return null;
  const [id, secret] = raw.split(".");
  if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const data = await db().selectFrom("crews").select(["id", "name", "secret_hash", "account_id"]).where("id", "=", id).executeTakeFirst();
  if (!data || !safeEqualHex(data.secret_hash, hashSecret(secret, env().APP_SECRET))) return null;
  return { id: data.id, name: data.name, account_id: data.account_id };
}

/**
 * Die aktive Crew dieses Browsers, oder null.
 *  - Angemeldet: die gewählte Crew des Kontos (sonst die zuletzt benutzte). Hat das Konto noch
 *    keine Crew, zählt die Crew vom Gerät, solange sie keinem anderen Konto gehört.
 *  - Ohne Konto: die Crew aus dem Crew-Cookie (wie bisher).
 */
export async function currentCrew(): Promise<{ id: string; name: string } | null> {
  const [account, device] = await Promise.all([currentAccount(), deviceCrew()]);
  if (account) {
    const crews = await accountCrews(account.id);
    const sel = (await cookies()).get(CREW_SELECT_COOKIE)?.value;
    const pick = crews.find((c) => c.id === sel) ?? crews.find((c) => c.id === device?.id) ?? crews[0];
    if (pick) return pick;
    if (device && !device.account_id) return { id: device.id, name: device.name };
    return null;
  }
  return device ? { id: device.id, name: device.name } : null;
}
