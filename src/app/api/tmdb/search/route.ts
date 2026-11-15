import type { NextRequest } from "next/server";
import { limitedShared } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { posterUrl, searchMovies } from "@/lib/server/tmdb";
import { releaseYear } from "@/lib/candidates";
import { requestLocale } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const blocked = await limitedShared(req, "search", 30);
  if (blocked) return blocked;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return jsonError(400, "Suchbegriff 2 bis 100 Zeichen");
  return handle(async () => {
    const results = await searchMovies(q, await requestLocale());
    return Response.json({
      results: results.map((m) => ({
        tmdbId: m.id,
        title: m.title,
        year: releaseYear(m.release_date),
        poster: posterUrl(m.poster_path, "w92"),
      })),
    });
  });
}
