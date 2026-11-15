import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { AppError } from "./http";
import { accountsEnabled } from "./db";

const loginOff = () => new AppError(404, "Anmeldung ist auf diesem Server ausgeschaltet");

/**
 * Supabase Auth prüft nur, dass eine E-Mail-Adresse dem Nutzer gehört (Magic-Link oder Code).
 * Die Supabase-Sitzung wird sofort verworfen; danach gilt unsere eigene Konto-Sitzung
 * (siehe account.ts). Der Browser spricht dabei nie mit Supabase.
 *
 * AUTH_MOCK=1 (nur außerhalb von Production): keine E-Mails, Code ist immer 123456,
 * der Link wird ins Server-Log geschrieben. Für lokale Tests und E2E.
 */
export const authMock = process.env.AUTH_MOCK === "1" && process.env.NODE_ENV !== "production";
export const MOCK_CODE = "123456";

// Für jede Anfrage ein eigener Client: verifyOtp merkt sich die Sitzung im Client.
// Der geteilte db()-Client darf davon nie etwas abbekommen, sonst liefe er mit Nutzerrechten.
function authClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });
}

/** Schickt die Anmelde-Mail mit Link (zu `redirectTo`) und Code. */
export async function sendLoginMail(email: string, redirectTo: string): Promise<void> {
  if (!accountsEnabled()) throw loginOff();
  if (authMock) {
    const link = `${redirectTo}?token_hash=${mockTokenHash(email)}&type=email`;
    console.log(`[AUTH_MOCK] Anmeldung für ${email}: Code ${MOCK_CODE}, Link ${link}`);
    return;
  }
  const { error } = await authClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  });
  if (!error) return;
  if (error.status === 429) throw new AppError(429, "Gerade wurden zu viele Mails verschickt. Bitte in ein paar Minuten nochmal.");
  console.error("Anmelde-Mail fehlgeschlagen:", error.status, error.code, error.message);
  throw new AppError(502, "Die Anmelde-Mail konnte nicht verschickt werden. Bitte später nochmal versuchen.");
}

export type VerifyInput = { tokenHash: string } | { email: string; code: string };

/** Prüft Link oder Code. Liefert die Supabase-Nutzer-ID und die bestätigte E-Mail-Adresse. */
export async function verifyLogin(input: VerifyInput): Promise<{ userId: string; email: string }> {
  if (!accountsEnabled()) throw loginOff();
  const invalid = new AppError(400, "Der Link oder Code ist ungültig oder abgelaufen. Fordere einfach einen neuen an.");
  if (authMock) {
    const email = "tokenHash" in input ? mockEmailFrom(input.tokenHash) : input.code === MOCK_CODE ? input.email : null;
    if (!email) throw invalid;
    return { userId: mockUserId(email), email };
  }
  const client = authClient();
  const { data, error } =
    "tokenHash" in input
      ? await client.auth.verifyOtp({ token_hash: input.tokenHash, type: "email" })
      : await client.auth.verifyOtp({ email: input.email, token: input.code, type: "email" });
  if (error || !data.user?.email) {
    if (error && error.status === 429) throw new AppError(429, "Zu viele Versuche. Bitte kurz warten.");
    if (error && (error.status ?? 0) >= 500) {
      console.error("Anmeldung prüfen fehlgeschlagen:", error.status, error.code, error.message);
      throw new AppError(502, "Anmeldung gerade nicht möglich. Bitte später nochmal.");
    }
    throw invalid;
  }
  return { userId: data.user.id, email: data.user.email.toLowerCase() };
}

// ---- Mock ----------------------------------------------------------------

function mockTokenHash(email: string) {
  return `mock.${Buffer.from(email).toString("base64url")}`;
}
function mockEmailFrom(tokenHash: string): string | null {
  if (!tokenHash.startsWith("mock.")) return null;
  const email = Buffer.from(tokenHash.slice(5), "base64url").toString();
  return email.includes("@") ? email : null;
}
function mockUserId(email: string) {
  const h = createHash("sha256").update(email).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
