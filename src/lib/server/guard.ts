import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { db } from "./db";
import { jsonError } from "./http";
import { isAllowedOrigin, parseAllowList } from "../origin";

/**
 * CSRF-Schutz: Schreibende Requests müssen von derselben Origin kommen
 * und JSON senden (einfache HTML-Formulare anderer Seiten können kein JSON schicken).
 */
export function checkSameOrigin(req: NextRequest): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return jsonError(403, "Origin fehlt");
  const hosts = [req.headers.get("x-forwarded-host") ?? "", req.headers.get("host") ?? ""];
  if (!isAllowedOrigin(origin, hosts, parseAllowList(process.env.ALLOWED_ORIGINS))) {
    return jsonError(403, "Fremde Origin. Für Tunnel/Port-Forwarding die Adresse in ALLOWED_ORIGINS eintragen.");
  }
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError(415, "JSON erwartet");
  }
  return null;
}

/** Body lesen (max. 8 KB) und mit zod prüfen. */
export async function parseBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: Response }> {
  const text = await req.text();
  if (text.length > 8192) return { error: jsonError(413, "Anfrage zu groß") };
  let json: unknown;
  try {
    json = JSON.parse(text || "{}");
  } catch {
    return { error: jsonError(400, "Ungültiges JSON") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { error: jsonError(400, "Ungültige Eingabe") };
  return { data: parsed.data };
}

// ---- Rate Limiting -------------------------------------------------------
// Einfacher Token-Bucket im Speicher, reicht für eine Instanz / privaten Betrieb.
// In Schritt 4 wird das für mehrere Instanzen auf einen gemeinsamen Speicher umgestellt.

type Bucket = { tokens: number; updated: number };
const buckets = new Map<string, Bucket>();

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** true = erlaubt. `perMinute` Anfragen pro Minute, kurze Spitzen bis `burst`. */
export function rateLimit(key: string, perMinute: number, burst = perMinute): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: burst, updated: now };
  b.tokens = Math.min(burst, b.tokens + ((now - b.updated) / 60000) * perMinute);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (now - v.updated > 600000) buckets.delete(k);
  }
  return true;
}

/**
 * Wer zählt fürs Limit? Beigetretene Teilnehmer einzeln (per Cookie), sonst die IP.
 * Wichtig, weil eine Gruppe im selben WLAN oft dieselbe öffentliche IP teilt.
 */
export function limitKey(req: NextRequest, code?: string): string {
  const c = code ? req.cookies.get(`fa_p_${code}`)?.value : undefined;
  return c ? `p:${c.slice(0, 22)}` : `ip:${clientIp(req)}`;
}

export function limited(req: NextRequest, name: string, perMinute: number, burst?: number, code?: string) {
  return rateLimit(`${name}:${limitKey(req, code)}`, perMinute, burst)
    ? null
    : jsonError(429, "Zu viele Anfragen, bitte kurz warten");
}

/**
 * Rate Limit über alle Server-Instanzen (Postgres). Für Endpunkte, bei denen
 * Missbrauch weh tut: Runde erstellen, beitreten (Code-Raten), TMDB-Suche, Abspann.
 * Vorher greift zusätzlich das schnelle In-Memory-Limit.
 */
export async function limitedShared(req: NextRequest, name: string, perMinute: number, burst = perMinute) {
  const local = limited(req, name, perMinute, burst);
  if (local) return local;
  const { data, error } = await db().rpc("rate_hit", {
    p_key: `${name}:${clientIp(req)}`.slice(0, 200),
    p_per_minute: perMinute,
    p_burst: burst,
  });
  if (error) {
    console.error(error);
    return null; // Limit-Speicher kaputt: lieber durchlassen als die App lahmlegen
  }
  return data === false ? jsonError(429, "Zu viele Anfragen, bitte kurz warten") : null;
}
