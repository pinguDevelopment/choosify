import type { NextRequest } from "next/server";
import { checkSameOrigin, limited, parseBody } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { tvStatusSchema } from "@/lib/server/schemas";
import { pairingStatus } from "@/lib/server/tv";

/**
 * Fernseher fragt alle paar Sekunden: Hat mich schon jemand gekoppelt?
 * Das Geheimnis steht im Body (nicht in der URL), damit es nicht in Server-Logs landet.
 */
export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? limited(req, "tv-status", 60, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, tvStatusSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    // Unbekannt oder abgelaufen: { gone: true }, dann holt sich der Fernseher einen neuen Code
    const status = await pairingStatus(body.data.secret);
    return Response.json(status ?? { gone: true }, { headers: { "Cache-Control": "no-store" } });
  });
}
