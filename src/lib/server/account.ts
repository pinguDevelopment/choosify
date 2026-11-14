import "server-only";
import { cookies } from "next/headers";
import { cookieBase } from "./cookie-opts";
import { db } from "./db";
import { env } from "./env";
import { hashSecret, newSecret } from "./tokens";

// Konto-Sitzung: 256-Bit-Token im httpOnly-Cookie, in der Datenbank nur der HMAC.
const ACCOUNT_COOKIE = "fa_acc";
// Gewählte Crew eines angemeldeten Kontos (nur die ID, wird bei jedem Zugriff gegen das Konto geprüft).
export const CREW_SELECT_COOKIE = "fa_crew_sel";
const SESSION_DAYS = 180;
export const MAX_CREWS_PER_ACCOUNT = 20;

export type Favorites = { ids: number[]; other: boolean };
export type Account = { id: string; email: string; favorites: Favorites };

/** Konto anlegen oder E-Mail aktualisieren, neue Sitzung starten und Cookie setzen. */
export async function startAccountSession(userId: string, email: string): Promise<void> {
  const { error } = await db().from("accounts").upsert({ id: userId, email }, { onConflict: "id" });
  if (error) throw error;
  const secret = newSecret();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const { error: sErr } = await db().from("account_sessions").insert({
    token_hash: hashSecret(secret, env().APP_SECRET),
    account_id: userId,
    expires_at: expires.toISOString(),
  });
  if (sErr) throw sErr;
  // Alte, abgelaufene Sitzungen dieses Kontos gleich mit aufräumen.
  await db().from("account_sessions").delete().eq("account_id", userId).lt("expires_at", new Date().toISOString());
  (await cookies()).set(ACCOUNT_COOKIE, secret, { ...cookieBase, maxAge: SESSION_DAYS * 86400 });
}

/** Das angemeldete Konto dieses Browsers, oder null. */
export async function currentAccount(): Promise<Account | null> {
  const secret = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (!secret || secret.length > 100) return null;
  const { data, error } = await db()
    .from("account_sessions")
    .select("account_id, expires_at")
    .eq("token_hash", hashSecret(secret, env().APP_SECRET))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: acc, error: aErr } = await db()
    .from("accounts")
    .select("id, email, favorite_provider_ids, favorite_other")
    .eq("id", data.account_id)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!acc) return null;
  return { id: acc.id, email: acc.email, favorites: { ids: acc.favorite_provider_ids ?? [], other: acc.favorite_other } };
}

/** Abmelden: Sitzung in der Datenbank löschen und Cookies entfernen. */
export async function endAccountSession(): Promise<void> {
  const jar = await cookies();
  const secret = jar.get(ACCOUNT_COOKIE)?.value;
  if (secret && secret.length <= 100) {
    const { error } = await db().from("account_sessions").delete().eq("token_hash", hashSecret(secret, env().APP_SECRET));
    if (error) throw error;
  }
  jar.delete({ name: ACCOUNT_COOKIE, path: "/" });
  jar.delete({ name: CREW_SELECT_COOKIE, path: "/" });
}

/** Überall abmelden: alle Sitzungen des Kontos löschen. */
export async function endAllSessions(accountId: string): Promise<void> {
  const { error } = await db().from("account_sessions").delete().eq("account_id", accountId);
  if (error) throw error;
  await endAccountSession();
}

export async function saveFavorites(accountId: string, f: Favorites): Promise<void> {
  const { error } = await db()
    .from("accounts")
    .update({ favorite_provider_ids: f.ids, favorite_other: f.other })
    .eq("id", accountId);
  if (error) throw error;
}

/** Favoriten vom Gerät mit denen im Konto zusammenführen (nichts geht verloren). */
export function mergeFavorites(a: Favorites, b: Favorites): Favorites {
  return { ids: [...new Set([...a.ids, ...b.ids])].slice(0, 60), other: a.other || b.other };
}

export type AccountCrew = { id: string; name: string };

/** Crews des Kontos, zuletzt benutzte zuerst. */
export async function accountCrews(accountId: string): Promise<AccountCrew[]> {
  const { data, error } = await db()
    .from("crews")
    .select("id, name")
    .eq("account_id", accountId)
    .order("last_used_at", { ascending: false })
    .limit(MAX_CREWS_PER_ACCOUNT);
  if (error) throw error;
  return data ?? [];
}

export async function selectCrew(crewId: string): Promise<void> {
  (await cookies()).set(CREW_SELECT_COOKIE, crewId, { ...cookieBase, maxAge: SESSION_DAYS * 86400 });
}
