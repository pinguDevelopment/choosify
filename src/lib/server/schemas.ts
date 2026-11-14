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
// liked = null nimmt eine Stimme zurück (Rückgängig-Knopf).
export const voteSchema = z.object({ tmdbId: tmdbIdSchema, liked: z.boolean().nullable() });
export const finishSchema = z.object({
  winnerTmdbId: tmdbIdSchema.nullable().default(null),
  addToAbspann: z.boolean().default(false),
});
export const abspannSchema = z.object({ tmdbId: tmdbIdSchema });
