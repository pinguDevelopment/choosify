import type { NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/account";
import { createInvite, crewMembers, removeMember, renameCrew, stopInvite } from "@/lib/server/crews";
import { checkSameOrigin, limited, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { crewPatchSchema } from "@/lib/server/schemas";

const isId = (v: string) => /^[0-9a-f-]{36}$/.test(v);

/** Mitglieder und Einladungsstatus einer Crew (nur für ihre Mitglieder). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/crews/[id]">) {
  const blocked = limited(req, "crew", 60);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    if (!isId(id)) return jsonError(404, "Crew nicht gefunden");
    return Response.json(await crewMembers(account.id, id), { headers: { "Cache-Control": "no-store" } });
  });
}

/** Umbenennen, Einladungslink erzeugen/stoppen, Mitglied entfernen oder austreten. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/crews/[id]">) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "crew-write", 10, 15));
  if (blocked) return blocked;
  const body = await parseBody(req, crewPatchSchema);
  if ("error" in body) return body.error;
  const { id } = await ctx.params;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    if (!isId(id)) return jsonError(404, "Crew nicht gefunden");
    const { name, invite, removeMember: member } = body.data;
    if (name) await renameCrew(account.id, id, name);
    let link: { token: string; until: string } | null = null;
    if (invite === "new") link = await createInvite(account.id, id);
    if (invite === "stop") await stopInvite(account.id, id);
    if (member) await removeMember(account.id, id, member);
    return Response.json({ ok: true, invite: link });
  });
}
