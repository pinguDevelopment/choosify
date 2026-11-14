import type { NextRequest } from "next/server";
import { mergeFavorites, saveFavorites, startAccountSession } from "@/lib/server/account";
import { verifyLogin } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { checkSameOrigin, limitedShared, limitedSharedKey, parseBody } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { verifySchema } from "@/lib/server/schemas";
import { db } from "@/lib/server/db";
import { hashSecret } from "@/lib/server/tokens";

/**
 * Magic-Link (token_hash) oder Code bestätigen und anmelden.
 * Absichtlich POST hinter einem Knopf: Link-Scanner in Mailprogrammen öffnen Links
 * automatisch und würden einen GET-Link sonst verbrauchen.
 */
export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "login-verify", 10, 15));
  if (blocked) return blocked;
  const body = await parseBody(req, verifySchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const input = body.data;
    if ("email" in input) {
      // Codes raten pro Adresse bremsen, egal von wie vielen IPs.
      const perMail = await limitedSharedKey(`login-verify-addr:${hashSecret(input.email, env().APP_SECRET).slice(0, 32)}`, 5, 10);
      if (perMail) return perMail;
    }
    const user = await verifyLogin(input);
    await startAccountSession(user.userId, user.email);
    // Favoriten von diesem Gerät ins Konto übernehmen.
    if (input.favorites && (input.favorites.ids.length > 0 || input.favorites.other)) {
      const { data, error } = await db()
        .from("accounts")
        .select("favorite_provider_ids, favorite_other")
        .eq("id", user.userId)
        .single();
      if (error) throw error;
      await saveFavorites(
        user.userId,
        mergeFavorites({ ids: data.favorite_provider_ids ?? [], other: data.favorite_other }, input.favorites),
      );
    }
    return Response.json({ ok: true, email: user.email });
  });
}
