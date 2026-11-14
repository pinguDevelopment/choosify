import { connection } from "next/server";
import { getGenres } from "@/lib/server/tmdb";
import { serverError } from "@/lib/server/http";

export async function GET() {
  // Zur Laufzeit ausführen (TMDB-Key ist beim Build nicht vorhanden); TMDB-Antwort wird per fetch gecacht.
  await connection();
  try {
    return Response.json({ genres: await getGenres() });
  } catch (err) {
    return serverError(err);
  }
}
