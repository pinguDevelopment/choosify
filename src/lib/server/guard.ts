import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { sql } from "kysely";
import { db, dbReady, dialect } from "./db";
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
  return limitedSharedKey(`${name}:${clientIp(req)}`, perMinute, burst);
}

/** Wie limitedShared, aber mit eigenem Schlüssel (z. B. pro E-Mail-Adresse statt pro IP). */
export async function limitedSharedKey(key: string, perMinute: number, burst = perMinute) {
  try {
    const ok = await rateHit(key.slice(0, 200), perMinute, burst);
    return ok ? null : jsonError(429, "Zu viele Anfragen, bitte kurz warten");
  } catch (err) {
    console.error(err);
    return null; // Limit-Speicher kaputt: lieber durchlassen als die App lahmlegen
  }
}

/**
 * Token-Bucket in der Datenbank, jeweils in einem einzigen Schritt (keine Sperren, keine Deadlocks).
 * Postgres nutzt die Funktion rate_hit, MariaDB und SQLite rechnen dasselbe direkt im Upsert.
 */
async function rateHit(key: string, perMinute: number, burst: number): Promise<boolean> {
  await dbReady();
  const d = dialect();
  if (d === "postgres") {
    const { rows } = await sql<{ ok: boolean }>`select rate_hit(${key}, ${perMinute}, ${burst}) as ok`.execute(db());
    return rows[0]?.ok !== false;
  }
  if (d === "mysql") {
    // Bei ON DUPLICATE KEY UPDATE sieht tokens noch das alte updated_at (Zuweisungen von links nach rechts)
    await sql`insert into rate_limits (\`key\`, tokens, updated_at) values (${key}, ${burst - 1}, current_timestamp(3))
      on duplicate key update
        tokens = least(${burst}, tokens + timestampdiff(microsecond, updated_at, current_timestamp(3)) / 60000000 * ${perMinute}) - 1,
        updated_at = current_timestamp(3)`.execute(db());
  } else {
    await sql`insert into rate_limits (key, tokens, updated_at) values (${key}, ${burst - 1}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      on conflict (key) do update set
        tokens = min(${burst}, tokens + (julianday('now') - julianday(updated_at)) * 1440.0 * ${perMinute}) - 1,
        updated_at = excluded.updated_at`.execute(db());
  }
  const row = await db().selectFrom("rate_limits").select("tokens").where("key", "=", key).executeTakeFirst();
  if (!row || row.tokens >= 0) return true;
  await db().updateTable("rate_limits").set({ tokens: 0 }).where("key", "=", key).execute();
  return false;
}
