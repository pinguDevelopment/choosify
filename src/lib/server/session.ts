import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";
import { hashSecret, isRoomCode, safeEqualHex } from "./tokens";

const secure = process.env.NODE_ENV === "production";
const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

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
  status: "lobby" | "voting" | "done";
  winner_tmdb_id: number | null;
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
  const { data, error } = await db()
    .from("rooms")
    .select("id, code, crew_id, region, provider_ids, status, winner_tmdb_id, expires_at")
    .eq("code", code)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data as Room | null;
}

/** Der aktuelle Teilnehmer in diesem Raum, erkannt am httpOnly-Cookie. */
export async function currentParticipant(room: Room): Promise<Participant | null> {
  const secret = (await cookies()).get(participantCookie(room.code))?.value;
  if (!secret || secret.length > 100) return null;
  const { data, error } = await db()
    .from("participants")
    .select("id, room_id, name, is_host, genre_ids, genres_done")
    .eq("room_id", room.id)
    .eq("token_hash", hashSecret(secret, env().APP_SECRET))
    .maybeSingle();
  if (error) throw error;
  return data as Participant | null;
}

/** Die Crew des Browsers (nur der Host hat sie), oder null. */
export async function currentCrew(): Promise<{ id: string; name: string } | null> {
  const raw = (await cookies()).get(CREW_COOKIE)?.value;
  if (!raw || raw.length > 200) return null;
  const [id, secret] = raw.split(".");
  if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data, error } = await db()
    .from("crews")
    .select("id, name, secret_hash")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || !safeEqualHex(data.secret_hash, hashSecret(secret, env().APP_SECRET))) return null;
  return { id: data.id, name: data.name };
}
