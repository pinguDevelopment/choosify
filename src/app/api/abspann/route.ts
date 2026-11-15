import type { NextRequest } from "next/server";
import { checkSameOrigin, limited, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { addAbspann, listAbspann, removeAbspann } from "@/lib/server/rooms";
import { abspannSchema } from "@/lib/server/schemas";
import { currentCrew } from "@/lib/server/session";
import { getMovie, getMovieDetails } from "@/lib/server/tmdb";
import { movieTags } from "@/lib/tags";
import { releaseYear } from "@/lib/candidates";
import { requestLocale } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const blocked = limited(req, "abspann", 60);
  if (blocked) return blocked;
  return handle(async () => {
    const crew = await currentCrew();
    if (!crew) return Response.json({ crew: null, movies: [], taste: null });
    return Response.json({ crew: { name: crew.name }, ...(await listAbspann(crew.id, await requestLocale())) });
  });
}

export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "abspann-write", 30));
  if (blocked) return blocked;
  const body = await parseBody(req, abspannSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const crew = await currentCrew();
    if (!crew) return jsonError(401, "Keine Crew gefunden");
    // Filmdaten vom Server bei TMDB holen statt dem Client zu vertrauen.
    const m = await getMovie(body.data.tmdbId);
    // Schlagwörter für die Tags (fürs Lernen des Geschmacks) und englischer Titel; ohne sie geht es auch
    const details = await getMovieDetails(m.id, "DE").catch(() => null);
    const keywords = details?.keywords ?? [];
    const year = releaseYear(m.release_date);
    await addAbspann(crew.id, {
      tmdbId: m.id,
      title: m.title,
      titleEn: details?.en.title ?? null,
      posterPath: m.poster_path ?? null,
      year,
      genreIds: m.genre_ids ?? [],
      tags: movieTags({ genreIds: m.genre_ids, keywords, year, rating: m.vote_average }),
    });
    return Response.json({ ok: true }, { status: 201 });
  });
}

export async function DELETE(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "abspann-write", 30));
  if (blocked) return blocked;
  const body = await parseBody(req, abspannSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const crew = await currentCrew();
    if (!crew) return jsonError(401, "Keine Crew gefunden");
    await removeAbspann(crew.id, body.data.tmdbId);
    return Response.json({ ok: true });
  });
}
