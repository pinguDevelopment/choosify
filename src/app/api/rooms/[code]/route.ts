import type { NextRequest } from "next/server";
import { limited } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { roomState } from "@/lib/server/rooms";
import { currentParticipant, loadRoom } from "@/lib/server/session";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]">) {
  // Großzügig, weil die Oberfläche alle paar Sekunden abfragt. Pro Teilnehmer gezählt.
  const { code } = await ctx.params;
  const blocked = limited(req, "room-state", 90, 30, code);
  if (blocked) return blocked;
  return handle(async () => {
    const room = await loadRoom(code);
    if (!room) return jsonError(404, "Runde nicht gefunden");
    const me = await currentParticipant(room);
    return Response.json(await roomState(room, me), { headers: { "Cache-Control": "no-store" } });
  });
}
