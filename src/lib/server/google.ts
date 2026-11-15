import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { authMock } from "./auth";
import { accountsEnabled } from "./db";
import { env } from "./env";
import { AppError } from "./http";

/**
 * Anmeldung mit Google über Supabase Auth (OAuth mit PKCE), komplett auf dem Server:
 *  1. /api/auth/google leitet zu Supabase weiter, Supabase weiter zu Google.
 *  2. Google schickt zurück zu Supabase, Supabase zu /api/auth/google/zurueck?code=...
 *  3. Der Server tauscht den Code (mit dem Prüfwert aus dem Cookie) gegen den Supabase-Nutzer.
 * Danach gilt wie beim Mail-Login nur unsere eigene Konto-Sitzung. Gleiche E-Mail-Adresse = gleiches Konto,
 * weil Supabase Google- und Mail-Anmeldung mit derselben bestätigten Adresse zu einem Nutzer zusammenlegt.
 *
 * Handy-App: Google erlaubt keine Anmeldung in einer eingebetteten WebView. Die App öffnet die Anmeldung
 * deshalb im Browser (Custom Tab) und bekommt danach über cinemood://anmelden ein kurzlebiges,
 * signiertes Ticket zurück. Das Ticket gilt nur zusammen mit dem Geheimnis, das nur die App kennt
 * (sie schickt am Anfang nur dessen SHA-256 mit). Eine fremde App, die den Link abfängt, kann damit nichts anfangen.
 */

export const GOOGLE_COOKIE = "fa_google";
export const GOOGLE_COOKIE_MAX_AGE = 10 * 60;
const TICKET_SECONDS = 5 * 60;

export type GoogleState = { verifier: string; next: string; app: string | null };

const b64url = (b: Buffer) => b.toString("base64url");
const sha256 = (s: string) => createHash("sha256").update(s).digest();

/** Nur Pfade auf dem eigenen Server als Rücksprungziel zulassen. */
export function safeNext(raw: string | null): string {
  if (!raw || raw.length > 200 || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/konto";
  return raw;
}

/** Wert für das Cookie mit dem PKCE-Prüfwert. Das Cookie ist httpOnly, ein Fälscher kann es nicht setzen. */
export function encodeState(s: GoogleState): string {
  return b64url(Buffer.from(JSON.stringify(s)));
}

export function decodeState(raw: string | undefined): GoogleState | null {
  if (!raw || raw.length > 1000) return null;
  try {
    const s = JSON.parse(Buffer.from(raw, "base64url").toString()) as GoogleState;
    if (typeof s.verifier !== "string" || typeof s.next !== "string") return null;
    return { verifier: s.verifier, next: safeNext(s.next), app: typeof s.app === "string" ? s.app : null };
  } catch {
    return null;
  }
}

export function isAppHash(v: string | null): v is string {
  return !!v && /^[A-Za-z0-9_-]{43}$/.test(v);
}

/** Ist Google bei Supabase eingeschaltet? Wird 5 Minuten gemerkt, damit nicht jeder Seitenaufruf nachfragt. */
let enabledCache: { value: boolean; until: number } | null = null;
export async function googleEnabled(): Promise<boolean> {
  if (!accountsEnabled()) return false;
  if (authMock) return true;
  if (enabledCache && enabledCache.until > Date.now()) return enabledCache.value;
  let value = false;
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY! },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (res.ok) value = ((await res.json()) as { external?: { google?: boolean } }).external?.google === true;
  } catch (err) {
    console.error("Supabase-Einstellungen nicht lesbar:", (err as Error).message);
  }
  enabledCache = { value, until: Date.now() + 5 * 60_000 };
  return value;
}

/** Startet die Anmeldung: Adresse, zu der der Browser geschickt wird, und der Wert fürs Cookie. */
export function startGoogle(origin: string, next: string, app: string | null, mockEmail?: string | null): { url: string; cookie: string } {
  if (!accountsEnabled()) throw new AppError(404, "Anmeldung ist auf diesem Server ausgeschaltet");
  const verifier = b64url(randomBytes(32));
  const cookie = encodeState({ verifier, next, app });
  const callback = `${origin}/api/auth/google/zurueck`;
  if (authMock) {
    // Ohne Google: gleich zurück, die "Google-Adresse" kommt aus ?mock= (nur Tests)
    const email = mockEmail && mockEmail.includes("@") ? mockEmail.toLowerCase() : "google@example.org";
    return { url: `${callback}?code=mock.${verifier}.${b64url(Buffer.from(email))}`, cookie };
  }
  const { SUPABASE_URL } = env();
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: callback,
    code_challenge: b64url(sha256(verifier)),
    code_challenge_method: "s256",
    // Immer die Kontoauswahl zeigen, damit man auf einem geteilten Gerät nicht im falschen Konto landet
    prompt: "select_account",
  });
  return { url: `${SUPABASE_URL}/auth/v1/authorize?${params}`, cookie };
}

/** Tauscht den Code von Supabase gegen Nutzer-ID und bestätigte E-Mail-Adresse. */
export async function finishGoogle(code: string, state: GoogleState): Promise<{ userId: string; email: string }> {
  const invalid = new AppError(400, "Die Anmeldung mit Google ist abgelaufen oder ungültig. Bitte nochmal versuchen.");
  if (code.length > 500) throw invalid;
  if (authMock) {
    const [tag, verifier, mail] = code.split(".");
    const mockEmail = mail ? Buffer.from(mail, "base64url").toString() : "";
    if (tag !== "mock" || verifier !== state.verifier || !mockEmail.includes("@")) throw invalid;
    const h = createHash("sha256").update(mockEmail).digest("hex");
    return { userId: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`, email: mockEmail };
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: state.verifier }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status >= 500) {
      console.error("Google-Anmeldung: Supabase antwortet", res.status);
      throw new AppError(502, "Anmeldung gerade nicht möglich. Bitte später nochmal.");
    }
    throw invalid;
  }
  const data = (await res.json()) as { user?: { id?: string; email?: string } };
  const userId = data.user?.id;
  const email = data.user?.email?.toLowerCase();
  if (!userId || !email) throw new AppError(400, "Dein Google-Konto hat keine E-Mail-Adresse freigegeben.");
  return { userId, email };
}

// ---- Ticket für die Handy-App ---------------------------------------------

function ticketSig(body: string): string {
  return createHmac("sha256", env().APP_SECRET).update(`app-login:${body}`).digest("base64url");
}

/** Kurzlebiges Ticket "<Daten>.<Signatur>", gebunden an den Hash des App-Geheimnisses. */
export function appTicket(userId: string, email: string, appHash: string): string {
  const body = b64url(Buffer.from(JSON.stringify({ u: userId, e: email, h: appHash, x: Math.floor(Date.now() / 1000) + TICKET_SECONDS })));
  return `${body}.${ticketSig(body)}`;
}

/** Prüft Ticket und App-Geheimnis. */
export function redeemAppTicket(ticket: string, secret: string): { userId: string; email: string } | null {
  if (ticket.length > 1000 || secret.length > 200) return null;
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(ticketSig(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString()) as { u: string; e: string; h: string; x: number };
    if (typeof d.x !== "number" || d.x < Date.now() / 1000) return null;
    const h = Buffer.from(b64url(sha256(secret)));
    const expected = Buffer.from(String(d.h));
    if (h.length !== expected.length || !timingSafeEqual(h, expected)) return null;
    return { userId: String(d.u), email: String(d.e) };
  } catch {
    return null;
  }
}
