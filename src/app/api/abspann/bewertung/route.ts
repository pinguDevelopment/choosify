import type { NextRequest } from "next/server";
import { checkSameOrigin, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { removeRating } from "@/lib/server/ratings";
import { removeRatingSchema } from "@/lib/server/schemas";
import { currentCrew } from "@/lib/server/session";

/** Die Crew löscht eine einzelne Bewertung (z. B. wenn ein Link in falsche Hände geraten ist). */
export async function DELETE(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "abspann-write", 30));
  if (blocked) return blocked;
  const body = await parseBody(req, removeRatingSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const crew = await currentCrew();
    if (!crew) return jsonError(401, "Keine Crew gefunden");
    await removeRating(crew.id, body.data.tmdbId, body.data.name);
    return Response.json({ ok: true });
  });
}
