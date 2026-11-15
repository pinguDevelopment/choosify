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
  // "Sonstige / eigene Quelle": auch Filme, die bei keinem gewählten Dienst laufen
  anySource: z.boolean().default(false),
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

// ---- Konto (Magic-Link) ----
export const emailSchema = z
  .string()
  .transform((s) => s.normalize("NFC").trim().toLowerCase())
  .pipe(z.email().max(254));

export const loginMailSchema = z.object({ email: emailSchema });

const favoritesSchema = z.object({
  ids: z.array(z.number().int().positive().max(1_000_000)).max(60),
  other: z.boolean(),
});

// Entweder der Link aus der Mail (token_hash) oder E-Mail + Code zum Abtippen.
export const verifySchema = z.union([
  z.object({ tokenHash: z.string().min(8).max(200).regex(/^[A-Za-z0-9._-]+$/), favorites: favoritesSchema.optional() }),
  z.object({ email: emailSchema, code: z.string().regex(/^\d{6,10}$/), favorites: favoritesSchema.optional() }),
]);

export const logoutSchema = z.object({ everywhere: z.boolean().default(false) });

export const accountPatchSchema = z
  .object({
    favorites: favoritesSchema.optional(),
    crewId: z.uuid().optional(),
    adoptDeviceCrew: z.literal(true).optional(),
  })
  .refine((v) => v.favorites || v.crewId || v.adoptDeviceCrew, "leer");

// ---- Bewertungen im Abspann ----
export const starsSchema = z.number().int().min(1).max(5);
export const rateSchema = z.object({ name: nameSchema, stars: starsSchema });
export const removeRatingSchema = z.object({ tmdbId: tmdbIdSchema, name: nameSchema });

// ---- Fernseher / Home Assistant ----
export const tvTokenSchema = z.string().min(20).max(120).regex(/^[0-9a-f-]{36}\.\d{1,7}\.[A-Za-z0-9_-]{43}$/);
// fresh = true: immer eine neue Runde (Knopf "Neue Runde" auf dem Fernseher)
export const tvOpenSchema = z.object({ token: tvTokenSchema, fresh: z.boolean().default(false) });
export const tvSettingsSchema = z.object({
  providerIds: z.array(z.number().int().positive().max(1_000_000)).max(30),
  anySource: z.boolean(),
});
