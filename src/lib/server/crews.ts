import "server-only";
import { randomUUID } from "node:crypto";
import { accountCrews, MAX_CREWS_PER_ACCOUNT, selectCrew } from "./account";
import { db, isUniqueViolation } from "./db";
import { env } from "./env";
import { AppError } from "./http";
import { hashSecret, newSecret } from "./tokens";

// Gemeinsame Watchlist: Eine Crew gehört einem Konto (crews.account_id) und kann weitere
// Konten als Mitglieder haben (crew_members). Alle Mitglieder sehen und bearbeiten dieselbe
// Watchlist mit denselben Sternen. Jede Person behält daneben ihre eigenen Crews.

/** Einladungslinks gelten so lange. */
const INVITE_DAYS = 7;
/** Höchstens so viele Konten in einer Crew. */
export const MAX_CREW_MEMBERS = 20;

const inviteHash = (token: string) => hashSecret(`invite:${token}`, env().APP_SECRET);

/** Prüft, dass das Konto zur Crew gehört, und liefert sie. Sonst 404 (ohne zu verraten, ob es sie gibt). */
export async function crewOf(accountId: string, crewId: string) {
  const crews = await accountCrews(accountId);
  const crew = crews.find((c) => c.id === crewId);
  if (!crew) throw new AppError(404, "Crew nicht gefunden");
  return crew;
}

/** Neue Crew für das Konto anlegen (z. B. „Wir zwei“) und gleich auswählen. */
export async function createCrew(accountId: string, name: string): Promise<string> {
  const crews = await accountCrews(accountId);
  if (crews.length >= MAX_CREWS_PER_ACCOUNT) throw new AppError(409, "Dein Konto hat schon die maximale Zahl an Crews");
  const id = randomUUID();
  // Ohne Crew-Cookie: Das Geheimnis braucht niemand, die Crew hängt am Konto.
  await db().insertInto("crews").values({ id, name, secret_hash: hashSecret(newSecret(), env().APP_SECRET), account_id: accountId }).execute();
  await selectCrew(id);
  return id;
}

export async function renameCrew(accountId: string, crewId: string, name: string) {
  await crewOf(accountId, crewId);
  await db().updateTable("crews").set({ name }).where("id", "=", crewId).execute();
}

/** Mitglieder einer Crew. Andere sehen nur den Teil der E-Mail-Adresse vor dem @. */
export async function crewMembers(accountId: string, crewId: string) {
  const crew = await crewOf(accountId, crewId);
  const owner = await db()
    .selectFrom("crews as c")
    .innerJoin("accounts as a", "a.id", "c.account_id")
    .select(["a.id", "a.email"])
    .where("c.id", "=", crewId)
    .executeTakeFirst();
  const others = await db()
    .selectFrom("crew_members as m")
    .innerJoin("accounts as a", "a.id", "m.account_id")
    .select(["a.id", "a.email"])
    .where("m.crew_id", "=", crewId)
    .orderBy("m.joined_at")
    .execute();
  const show = (p: { id: string; email: string }, isOwner: boolean) => ({
    id: p.id,
    name: p.email.split("@")[0],
    owner: isOwner,
    me: p.id === accountId,
  });
  const invite = await db().selectFrom("crews").select(["invite_expires_at"]).where("id", "=", crewId).executeTakeFirst();
  const inviteActive = !!invite?.invite_expires_at && invite.invite_expires_at > new Date().toISOString();
  return {
    id: crew.id,
    name: crew.name,
    owner: crew.owner,
    inviteUntil: inviteActive ? invite!.invite_expires_at : null,
    members: [...(owner ? [show(owner, true)] : []), ...others.map((p) => show(p, false))],
  };
}

/** Neuen Einladungslink erzeugen. Ersetzt den alten Link. Jedes Mitglied darf einladen. */
export async function createInvite(accountId: string, crewId: string): Promise<{ token: string; until: string }> {
  await crewOf(accountId, crewId);
  const token = newSecret();
  const until = new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString();
  await db().updateTable("crews").set({ invite_hash: inviteHash(token), invite_expires_at: until }).where("id", "=", crewId).execute();
  return { token, until };
}

/** Einladungslink ungültig machen. */
export async function stopInvite(accountId: string, crewId: string) {
  await crewOf(accountId, crewId);
  await db().updateTable("crews").set({ invite_hash: null, invite_expires_at: null }).where("id", "=", crewId).execute();
}

const isInviteToken = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

async function crewByInvite(token: string) {
  if (!isInviteToken(token)) throw new AppError(404, "Diese Einladung ist ungültig oder abgelaufen");
  const crew = await db()
    .selectFrom("crews")
    .select(["id", "name", "account_id"])
    .where("invite_hash", "=", inviteHash(token))
    .where("invite_expires_at", ">", new Date().toISOString())
    .executeTakeFirst();
  if (!crew) throw new AppError(404, "Diese Einladung ist ungültig oder abgelaufen");
  return crew;
}

/** Was die Einladungsseite zeigt: Name der Crew und ob man schon drin ist. */
export async function inviteInfo(token: string, accountId: string | null) {
  const crew = await crewByInvite(token);
  const member = accountId ? (await accountCrews(accountId)).some((c) => c.id === crew.id) : false;
  return { name: crew.name, member };
}

/** Einladung annehmen: Konto wird Mitglied der Crew, die Crew wird gleich ausgewählt. */
export async function acceptInvite(token: string, accountId: string) {
  const crew = await crewByInvite(token);
  const mine = await accountCrews(accountId);
  if (!mine.some((c) => c.id === crew.id)) {
    if (mine.length >= MAX_CREWS_PER_ACCOUNT) throw new AppError(409, "Dein Konto hat schon die maximale Zahl an Crews");
    const all = await db().selectFrom("crew_members").select("account_id").where("crew_id", "=", crew.id).execute();
    if (all.length + 1 >= MAX_CREW_MEMBERS) throw new AppError(409, "Diese Crew ist voll");
    try {
      await db().insertInto("crew_members").values({ crew_id: crew.id, account_id: accountId }).execute();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
    // Crew ohne Besitzer (z. B. Konto gelöscht): Wer beitritt, übernimmt sie
    if (!crew.account_id) {
      await db().updateTable("crews").set({ account_id: accountId }).where("id", "=", crew.id).where("account_id", "is", null).execute();
      await db().deleteFrom("crew_members").where("crew_id", "=", crew.id).where("account_id", "=", accountId).execute();
    }
  }
  await selectCrew(crew.id);
  return { id: crew.id, name: crew.name };
}

/**
 * Mitglied entfernen oder selbst austreten.
 *  - Mitglieder dürfen sich selbst entfernen (austreten).
 *  - Die Besitzerin darf andere entfernen. Tritt sie selbst aus, übernimmt das
 *    am längsten dabei gewesene Mitglied die Crew. Ist sonst niemand da, bleibt die Crew bei ihr.
 */
export async function removeMember(accountId: string, crewId: string, memberId: string) {
  const crew = await crewOf(accountId, crewId);
  if (memberId !== accountId && !crew.owner) throw new AppError(403, "Nur wer die Crew angelegt hat, kann andere entfernen");
  if (memberId === accountId && crew.owner) {
    const next = await db()
      .selectFrom("crew_members")
      .select("account_id")
      .where("crew_id", "=", crewId)
      .orderBy("joined_at")
      .executeTakeFirst();
    if (!next) throw new AppError(409, "Du bist allein in dieser Crew");
    await db().updateTable("crews").set({ account_id: next.account_id }).where("id", "=", crewId).execute();
    await db().deleteFrom("crew_members").where("crew_id", "=", crewId).where("account_id", "=", next.account_id).execute();
    return;
  }
  await db().deleteFrom("crew_members").where("crew_id", "=", crewId).where("account_id", "=", memberId).execute();
}

/**
 * Watchlist samt Filmen und Sternen löschen. Nur wer sie angelegt hat, darf das (auch wenn sie
 * geteilt ist, dann ist sie für alle weg). Mitglieder treten stattdessen aus.
 * Runden, die die Crew benutzt haben, laufen ohne Crew weiter (crew_id wird null).
 */
export async function deleteCrew(accountId: string, crewId: string) {
  const crew = await crewOf(accountId, crewId);
  if (!crew.owner) throw new AppError(403, "Nur wer die Watchlist angelegt hat, kann sie löschen");
  await db().deleteFrom("crews").where("id", "=", crewId).where("account_id", "=", accountId).execute();
}
