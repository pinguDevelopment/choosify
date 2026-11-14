import type { NextRequest } from "next/server";
import { checkSameOrigin, limited, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { joinRoom } from "@/lib/server/rooms";
import { joinSchema } from "@/lib/server/schemas";
import { currentParticipant, loadRoom } from "@/lib/server/session";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]/join">) {
  // Streng limitiert: schützt auch gegen das Durchprobieren von Raum-Codes.
  const blocked = checkSameOrigin(req) ?? limited(req, "join", 10, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, joinSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const room = await loadRoom((await ctx.params).code);
    if (!room) return jsonError(404, "Runde nicht gefunden");
    if (await currentParticipant(room)) return Response.json({ ok: true });
    await joinRoom(room, body.data.name);
    return Response.json({ ok: true }, { status: 201 });
  });
}
