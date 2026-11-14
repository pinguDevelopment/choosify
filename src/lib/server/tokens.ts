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
