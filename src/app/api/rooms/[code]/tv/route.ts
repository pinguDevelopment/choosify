import type { NextRequest } from "next/server";
import { limited } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { roomAction } from "@/lib/server/room-route";
import { tvPairSchema } from "@/lib/server/schemas";
import { loadRoom } from "@/lib/server/session";
import { linkPairing, tvRoomState } from "@/lib/server/tv";
import { requestLocale } from "@/lib/i18n/server";

/** Fortschritt für die Fernseh-Ansicht (fragt alle paar Sekunden ab). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]/tv">) {
  const blocked = limited(req, "room-tv", 40, 20);
  if (blocked) return blocked;
  return handle(async () => {
    const room = await loadRoom((await ctx.params).code);
    if (!room) return jsonError(404, "Runde nicht gefunden");
    return Response.json(await tvRoomState(room, await requestLocale()), { headers: { "Cache-Control": "no-store" } });
  });
}

/**
 * Host gibt den Code vom Fernseher ein. Limit über alle Server-Instanzen,
 * damit niemand fremde Codes durchprobieren kann.
 */
export const POST = roomAction("tv-link", tvPairSchema, async ({ room, me, data }) => {
  await linkPairing(room, me, data.code);
  return Response.json({ ok: true });
}, 10, true);
