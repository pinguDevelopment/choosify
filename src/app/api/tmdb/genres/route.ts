import { connection } from "next/server";
import { getGenres } from "@/lib/server/tmdb";
import { serverError } from "@/lib/server/http";
import { requestLocale } from "@/lib/i18n/server";
import { genreNames } from "@/lib/tags";

export async function GET() {
  // Zur Laufzeit ausführen (TMDB-Key ist beim Build nicht vorhanden); TMDB-Antwort wird per fetch gecacht.
  await connection();
  try {
    const locale = await requestLocale();
    // Dieselben Namen wie auf den Karten; Genres, die wir nicht kennen, behalten den Namen von TMDB
    const genres = (await getGenres(locale)).map((g) => ({ id: g.id, name: genreNames([g.id], 1, locale)[0] ?? g.name }));
    return Response.json({ genres });
  } catch (err) {
    return serverError(err);
  }
}
