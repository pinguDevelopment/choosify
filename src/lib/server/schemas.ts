import "server-only";
import { z } from "zod";

// Namen: keine Steuerzeichen, getrimmt, 1-30 Zeichen.
export const nameSchema = z
  .string()
  .transform((s) => s.normalize("NFC").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(30).regex(/^[^\p{C}<>]+$/u));

export const tmdbIdSchema = z.number().int().positive().max(100_000_000);

export const createRoomSchema = z.object({
  hostName: nameSchema,
  region: z.string().regex(/^[A-Z]{2}$/).default("DE"),
  providerIds: z.array(z.number().int().positive()).max(30).default([]),
  crewName: nameSchema.optional(),
});

export const joinSchema = z.object({ name: nameSchema });
export const genresSchema = z.object({ genreIds: z.array(z.number().int().positive()).max(20) });
// choice = null nimmt eine Stimme zurück (Rückgängig-Knopf).
export const voteSchema = z.object({ tmdbId: tmdbIdSchema, choice: z.enum(["yes", "maybe", "no"]).nullable() });
// Den Gewinner bestimmt der Server aus der Rangliste (bei Gleichstand per Stichwahl).
export const finishSchema = z.object({
  addToAbspann: z.boolean().default(false),
});
export const runoffSchema = z.object({ tmdbId: tmdbIdSchema });
export const abspannSchema = z.object({ tmdbId: tmdbIdSchema });
