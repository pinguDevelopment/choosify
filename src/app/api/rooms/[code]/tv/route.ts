import type { NextRequest } from "next/server";
import { limited } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { loadRoom } from "@/lib/server/session";
import { tvRoomState } from "@/lib/server/tv";

/** Fortschritt für die Fernseh-Ansicht (fragt alle paar Sekunden ab). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]/tv">) {
  const blocked = limited(req, "room-tv", 40, 20);
  if (blocked) return blocked;
  return handle(async () => {
    const room = await loadRoom((await ctx.params).code);
    if (!room) return jsonError(404, "Runde nicht gefunden");
    return Response.json(await tvRoomState(room), { headers: { "Cache-Control": "no-store" } });
  });
}
