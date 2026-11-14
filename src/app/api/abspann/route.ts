import type { NextRequest } from "next/server";
import { checkSameOrigin, limited, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { addAbspann, listAbspann, removeAbspann } from "@/lib/server/rooms";
import { abspannSchema } from "@/lib/server/schemas";
import { currentCrew } from "@/lib/server/session";
import { getMovie } from "@/lib/server/tmdb";
import { releaseYear } from "@/lib/candidates";

export async function GET(req: NextRequest) {
  const blocked = limited(req, "abspann", 60);
  if (blocked) return blocked;
  return handle(async () => {
    const crew = await currentCrew();
    if (!crew) return Response.json({ crew: null, movies: [] });
    return Response.json({ crew: { name: crew.name }, movies: await listAbspann(crew.id) });
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
    await addAbspann(crew.id, {
      tmdbId: m.id,
      title: m.title,
      posterPath: m.poster_path ?? null,
      year: releaseYear(m.release_date),
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
