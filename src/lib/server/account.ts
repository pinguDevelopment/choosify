import "server-only";
import { cookies } from "next/headers";
import { cookieBase } from "./cookie-opts";
import { accountsEnabled, countAll, db, upsert } from "./db";
import { isOutdatedSchema } from "./http";
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
  await upsert("accounts", { id: userId, email }, ["id"]);
  const secret = newSecret();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db()
    .insertInto("account_sessions")
    .values({ token_hash: hashSecret(secret, env().APP_SECRET), account_id: userId, expires_at: expires.toISOString() })
    .execute();
  // Alte, abgelaufene Sitzungen dieses Kontos gleich mit aufräumen.
  await db().deleteFrom("account_sessions").where("account_id", "=", userId).where("expires_at", "<", new Date().toISOString()).execute();
  (await cookies()).set(ACCOUNT_COOKIE, secret, { ...cookieBase, maxAge: SESSION_DAYS * 86400 });
}

/** Das angemeldete Konto dieses Browsers, oder null. */
export async function currentAccount(): Promise<Account | null> {
  if (!accountsEnabled()) return null;
  const secret = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (!secret || secret.length > 100) return null;
  const acc = await db()
    .selectFrom("account_sessions as s")
    .innerJoin("accounts as a", "a.id", "s.account_id")
    .select(["a.id", "a.email", "a.favorite_provider_ids", "a.favorite_other"])
    .where("s.token_hash", "=", hashSecret(secret, env().APP_SECRET))
    .where("s.expires_at", ">", new Date().toISOString())
    .executeTakeFirst();
  if (!acc) return null;
  return { id: acc.id, email: acc.email, favorites: { ids: acc.favorite_provider_ids ?? [], other: acc.favorite_other } };
}

/** Abmelden: Sitzung in der Datenbank löschen und Cookies entfernen. */
export async function endAccountSession(): Promise<void> {
  const jar = await cookies();
  const secret = jar.get(ACCOUNT_COOKIE)?.value;
  if (secret && secret.length <= 100) {
    await db().deleteFrom("account_sessions").where("token_hash", "=", hashSecret(secret, env().APP_SECRET)).execute();
  }
  jar.delete({ name: ACCOUNT_COOKIE, path: "/" });
  jar.delete({ name: CREW_SELECT_COOKIE, path: "/" });
}

/** Überall abmelden: alle Sitzungen des Kontos löschen. */
export async function endAllSessions(accountId: string): Promise<void> {
  await db().deleteFrom("account_sessions").where("account_id", "=", accountId).execute();
  await endAccountSession();
}

export async function saveFavorites(accountId: string, f: Favorites): Promise<void> {
  await db().updateTable("accounts").set({ favorite_provider_ids: f.ids, favorite_other: f.other }).where("id", "=", accountId).execute();
}

/** Favoriten vom Gerät mit denen im Konto zusammenführen (nichts geht verloren). */
export function mergeFavorites(a: Favorites, b: Favorites): Favorites {
  return { ids: [...new Set([...a.ids, ...b.ids])].slice(0, 60), other: a.other || b.other };
}

export type AccountCrew = {
  id: string;
  name: string;
  /** Konto hat die Crew angelegt (darf Mitglieder entfernen) */
  owner: boolean;
  /** Anzahl Konten in der Crew (1 = nur du) */
  members: number;
};

/**
 * Crews des Kontos, zuletzt benutzte zuerst: eigene und solche, in die das Konto
 * eingeladen wurde (gemeinsame Watchlist und gemeinsamer Abspann).
 */
export async function accountCrews(accountId: string): Promise<AccountCrew[]> {
  let rows: { id: string; name: string; account_id: string | null }[];
  try {
    rows = await db()
      .selectFrom("crews")
      .select(["id", "name", "account_id"])
      .where((eb) =>
        eb.or([
          eb("account_id", "=", accountId),
          eb("id", "in", eb.selectFrom("crew_members").select("crew_id").where("account_id", "=", accountId)),
        ]),
      )
      .orderBy("last_used_at", "desc")
      .limit(MAX_CREWS_PER_ACCOUNT)
      .execute();
  } catch (err) {
    // Update-SQL für gemeinsame Crews noch nicht eingespielt: wie bisher nur eigene Crews
    if (!isOutdatedSchema(err)) throw err;
    const own = await db()
      .selectFrom("crews")
      .select(["id", "name"])
      .where("account_id", "=", accountId)
      .orderBy("last_used_at", "desc")
      .limit(MAX_CREWS_PER_ACCOUNT)
      .execute();
    return own.map((c) => ({ ...c, owner: true, members: 1 }));
  }
  const counts = new Map<string, number>();
  if (rows.length) {
    const n = await db()
      .selectFrom("crew_members")
      .select(["crew_id", countAll()])
      .where("crew_id", "in", rows.map((r) => r.id))
      .groupBy("crew_id")
      .execute();
    for (const r of n) counts.set(r.crew_id, Number(r.n));
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.account_id === accountId,
    members: (r.account_id ? 1 : 0) + (counts.get(r.id) ?? 0),
  }));
}

export async function selectCrew(crewId: string): Promise<void> {
  (await cookies()).set(CREW_SELECT_COOKIE, crewId, { ...cookieBase, maxAge: SESSION_DAYS * 86400 });
}
