import type { NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/account";
import { acceptInvite, inviteInfo } from "@/lib/server/crews";
import { checkSameOrigin, limited, limitedShared } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";

// Einladung in eine gemeinsame Watchlist. Der Link ist ein Geheimnis (256 Bit),
// in der Datenbank steht nur sein HMAC. Annehmen geht nur mit Konto.

export async function GET(req: NextRequest, ctx: RouteContext<"/api/einladung/[token]">) {
  const blocked = limited(req, "invite-read", 30);
  if (blocked) return blocked;
  const { token } = await ctx.params;
  return handle(async () => {
    const account = await currentAccount();
    const info = await inviteInfo(token, account?.id ?? null);
    return Response.json({ ...info, signedIn: !!account }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/einladung/[token]">) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "invite-accept", 10, 15));
  if (blocked) return blocked;
  const { token } = await ctx.params;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    return Response.json(await acceptInvite(token, account.id));
  });
}
