import type { NextRequest } from "next/server";
import { checkSameOrigin, limited, limitedSharedKey, parseBody } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { tvOpenSchema } from "@/lib/server/schemas";
import { checkTvToken, openTvRoom } from "@/lib/server/tv";

/**
 * Fernseher-Link öffnen: gibt den Code der laufenden Runde zurück oder legt eine neue an.
 * Der Link steht im Body (nicht in der URL), damit er nicht in Server-Logs landet.
 */
export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? limited(req, "tv-open", 20, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, tvOpenSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const tv = await checkTvToken(body.data.token);
    // Neue Runden pro Crew begrenzen (über alle Server-Instanzen)
    const res = await openTvRoom(tv, body.data.fresh, () => limitedSharedKey(`tv-room:${tv.crewId}`, 4, 6));
    if ("blocked" in res) return res.blocked;
    return Response.json({ code: res.code }, { headers: { "Cache-Control": "no-store" } });
  });
}
