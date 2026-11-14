import "server-only";
import { z } from "zod";

const schema = z.object({
  TMDB_READ_TOKEN: z.string().min(20),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_SECRET: z.string().min(32),
});

let cached: z.infer<typeof schema> | null = null;

/** Liest und prüft die Server-Umgebungsvariablen. Wirft, wenn etwas fehlt. */
export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Fehlende oder ungültige Umgebungsvariablen: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
