import "server-only";
import { db } from "./db";
import { env } from "./env";
import { AppError } from "./http";
import { insertRoom, localized } from "./rooms";
import type { Locale } from "../i18n/config";
import { posterUrl } from "./tmdb";
import { parseTvToken, tvToken } from "./tokens";
import type { Room } from "./session";

// Fernseher-Link: Öffnet auf dem Fernseher eine Runde für die Crew und zeigt den QR-Code.
// Home Assistant macht nichts anderes, als diesen Link im Browser des Fernsehers zu öffnen.

export type TvSettings = { token: string; providerIds: number[]; anySource: boolean };

/** Ein Fernseher-Raum gilt so lange als "derselbe Abend", danach startet der Link eine neue Runde. */
const REUSE_HOURS = 6;

export async function loadTvSettings(crewId: string): Promise<TvSettings | null> {
  const { data, error } = await db()
    .from("crew_tv")
    .select("version, provider_ids, any_source")
    .eq("crew_id", crewId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    token: tvToken(crewId, data.version, env().APP_SECRET),
    providerIds: data.provider_ids ?? [],
    anySource: data.any_source,
  };
}

/** Dienste speichern. Gibt es noch keinen Link, entsteht er dabei. */
export async function saveTvSettings(crewId: string, providerIds: number[], anySource: boolean): Promise<TvSettings> {
  const now = new Date().toISOString();
  const { data: existing, error } = await db().from("crew_tv").select("crew_id").eq("crew_id", crewId).maybeSingle();
  if (error) throw error;
  const fields = { provider_ids: [...new Set(providerIds)], any_source: anySource, updated_at: now };
  const { error: wErr } = existing
    ? await db().from("crew_tv").update(fields).eq("crew_id", crewId)
    : await db().from("crew_tv").insert({ crew_id: crewId, ...fields });
  if (wErr) throw wErr;
  return (await loadTvSettings(crewId))!;
}

/** Neuen Link erzeugen: Die Version steigt, alle alten Links gehen nicht mehr. */
export async function renewTvLink(crewId: string): Promise<TvSettings> {
  const { data, error } = await db().from("crew_tv").select("version").eq("crew_id", crewId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, "Für diese Crew ist noch kein Fernseher eingerichtet");
  const { error: uErr } = await db()
    .from("crew_tv")
    .update({ version: data.version + 1, last_room_id: null, updated_at: new Date().toISOString() })
    .eq("crew_id", crewId)
    .eq("version", data.version);
  if (uErr) throw uErr;
  return (await loadTvSettings(crewId))!;
}

export async function removeTv(crewId: string): Promise<void> {
  const { error } = await db().from("crew_tv").delete().eq("crew_id", crewId);
  if (error) throw error;
}

/** Prüft den Link und gibt die Crew zurück, oder wirft 404 (falscher oder alter Link). */
export async function checkTvToken(token: string): Promise<{ crewId: string; lastRoomId: string | null; providerIds: number[]; anySource: boolean }> {
  const parsed = parseTvToken(token, env().APP_SECRET);
  const gone = new AppError(404, "Dieser Fernseher-Link gilt nicht mehr. Im Web unter „Fernseher“ gibt es den aktuellen.");
  if (!parsed) throw gone;
  const { data, error } = await db()
    .from("crew_tv")
    .select("version, provider_ids, any_source, last_room_id")
    .eq("crew_id", parsed.crewId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.version !== parsed.version) throw gone;
  return { crewId: parsed.crewId, lastRoomId: data.last_room_id, providerIds: data.provider_ids ?? [], anySource: data.any_source };
}

/**
 * Runde für den Fernseher: Läuft vom selben Abend noch eine (Lobby, Swipen oder Stichwahl),
 * kommt dieselbe zurück. Sonst, oder mit fresh = true, entsteht eine neue ohne Host.
 * `allowCreate` prüft vorher das Rate Limit, damit nur neue Runden zählen.
 */
export async function openTvRoom(
  tv: Awaited<ReturnType<typeof checkTvToken>>,
  fresh: boolean,
  allowCreate: () => Promise<Response | null>,
): Promise<{ code: string } | { blocked: Response }> {
  if (!fresh && tv.lastRoomId) {
    const since = new Date(Date.now() - REUSE_HOURS * 3600_000).toISOString();
    const { data, error } = await db()
      .from("rooms")
      .select("code, status")
      .eq("id", tv.lastRoomId)
      .gt("expires_at", new Date().toISOString())
      .gt("created_at", since)
      .neq("status", "done")
      .maybeSingle();
    if (error) throw error;
    if (data) return { code: data.code };
  }
  const blocked = await allowCreate();
  if (blocked) return { blocked };
  const room = await insertRoom({ crewId: tv.crewId, region: "DE", providerIds: tv.providerIds, anySource: tv.anySource });
  // Nur übernehmen, wenn nicht gleichzeitig schon eine andere Runde entstanden ist
  // (z. B. Home Assistant löst doppelt aus). Sonst die eigene wieder löschen und die andere zeigen.
  const swap = db().from("crew_tv").update({ last_room_id: room.id }).eq("crew_id", tv.crewId);
  const { data: won, error: tErr } = await (tv.lastRoomId ? swap.eq("last_room_id", tv.lastRoomId) : swap.is("last_room_id", null)).select("crew_id");
  if (tErr) throw tErr;
  if (!won?.length) {
    const { error: dErr } = await db().from("rooms").delete().eq("id", room.id);
    if (dErr) throw dErr;
    const { data: other, error: oErr } = await db().from("crew_tv").select("last_room_id").eq("crew_id", tv.crewId).maybeSingle();
    if (oErr) throw oErr;
    const { data: otherRoom, error: rErr } = other?.last_room_id
      ? await db().from("rooms").select("code").eq("id", other.last_room_id).maybeSingle()
      : { data: null, error: null };
    if (rErr) throw rErr;
    const code = otherRoom?.code as string | undefined;
    if (!code) throw new AppError(409, "Gerade wurde schon eine Runde gestartet, bitte neu laden");
    return { code };
  }
  const { error: cErr } = await db().from("crews").update({ last_used_at: new Date().toISOString() }).eq("id", tv.crewId);
  if (cErr) throw cErr;
  return { code: room.code };
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
