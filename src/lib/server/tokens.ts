import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L).
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 10; // ~49 Bit, zusammen mit Rate Limiting nicht erratbar

/** Raum-Code für QR-Code und Link, z.B. "K7QM2XH9TA". */
export function newRoomCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export function isRoomCode(v: string): boolean {
  return v.length === CODE_LENGTH && [...v].every((c) => CODE_ALPHABET.includes(c));
}

/** Geheimes Token (256 Bit) für Teilnehmer, Host oder Crew. Nur im httpOnly-Cookie. */
export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** In der DB liegt nur der HMAC des Tokens, nie das Token selbst. */
export function hashSecret(secret: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(secret).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Bewertungslink für einen Film im Abspann einer Crew: "<crewId>.<tmdbId>.<Signatur>".
 * Die Signatur (HMAC, 128 Bit) verhindert, dass jemand Links für fremde Crews oder Filme
 * baut. Nichts davon steht in der Datenbank; der Link gilt, solange der Film im Abspann ist.
 */
function rateSig(crewId: string, tmdbId: number, appSecret: string): string {
  return createHmac("sha256", appSecret).update(`rate:${crewId}:${tmdbId}`).digest("base64url").slice(0, 22);
}

export function rateToken(crewId: string, tmdbId: number, appSecret: string): string {
  return `${crewId}.${tmdbId}.${rateSig(crewId, tmdbId, appSecret)}`;
}

export function parseRateToken(token: string, appSecret: string): { crewId: string; tmdbId: number } | null {
  if (token.length > 100) return null;
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(\d{1,9})\.([A-Za-z0-9_-]{22})$/.exec(token);
  if (!m) return null;
  const tmdbId = Number(m[2]);
  const want = Buffer.from(rateSig(m[1], tmdbId, appSecret));
  const got = Buffer.from(m[3]);
  if (tmdbId <= 0 || want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return { crewId: m[1], tmdbId };
}

/** Kopplungscode für den Fernseher, z.B. "K7Q2XH" (6 Zeichen, ~30 Bit, gilt nur 15 Minuten). */
export const PAIR_CODE_LENGTH = 6;

export function newPairCode(): string {
  let s = "";
  for (let i = 0; i < PAIR_CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Eingabe vom Handy aufräumen: Leerzeichen und Striche weg, Großbuchstaben. */
export function normalizePairCode(v: string): string {
  return v.toUpperCase().replace(/[\s-]/g, "");
}

export function isPairCode(v: string): boolean {
  return v.length === PAIR_CODE_LENGTH && [...v].every((c) => CODE_ALPHABET.includes(c));
}
