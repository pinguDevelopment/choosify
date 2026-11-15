import "server-only";
import { z } from "zod";
import { dbKind } from "./db";

// TMDB_MOCK=1 liefert Testdaten statt echter TMDB-Abfragen (nur außerhalb von Produktion).
export const tmdbMock = process.env.TMDB_MOCK === "1" && process.env.NODE_ENV !== "production";

// Supabase-Adresse und -Schlüssel braucht nur der Mail-Login, also nur mit DATABASE=supabase.
const supabase = () => dbKind() === "supabase";
const makeSchema = () =>
  z.object({
    TMDB_READ_TOKEN: tmdbMock ? z.string().optional() : z.string().min(32),
    SUPABASE_URL: supabase() ? z.url() : z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: supabase() ? z.string().min(20) : z.string().optional(),
    APP_SECRET: z.string().min(32),
  });

let cached: z.infer<ReturnType<typeof makeSchema>> | null = null;

/** Liest und prüft die Server-Umgebungsvariablen. Wirft, wenn etwas fehlt. */
export function env() {
  if (!cached) {
    const parsed = makeSchema().safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Fehlende oder ungültige Umgebungsvariablen: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
