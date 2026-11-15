import type { NextRequest } from "next/server";
import { limited } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { getMovieInfo } from "@/lib/server/tmdb";
import { requestLocale } from "@/lib/i18n/server";

// Detailansicht einer Votekarte: Besetzung, Regie, Trailer, IMDb-Link.
// Nur öffentliche TMDB-Daten; der Abruf ist serverseitig gecacht, darum reicht das schnelle Limit.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/movies/[id]">) {
  const blocked = limited(req, "movie-info", 40, 20);
  if (blocked) return blocked;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) return jsonError(400, "Ungültige Eingabe");
  return handle(async () => {
    try {
      const info = await getMovieInfo(id, await requestLocale());
      return Response.json(info, { headers: { "Cache-Control": "private, max-age=3600" } });
    } catch (err) {
      console.error(err);
      return jsonError(502, "Filmdetails gerade nicht erreichbar");
    }
  });
}
