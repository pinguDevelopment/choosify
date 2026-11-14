import type { NextRequest } from "next/server";
import { sendLoginMail } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { checkSameOrigin, limitedShared, limitedSharedKey, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { loginMailSchema } from "@/lib/server/schemas";
import { hashSecret } from "@/lib/server/tokens";

/** Anmelde-Mail mit Magic-Link und Code anfordern. */
export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "login-mail", 3, 6));
  if (blocked) return blocked;
  const body = await parseBody(req, loginMailSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const { email } = body.data;
    // Zusätzlich pro Adresse begrenzen, damit niemand fremde Postfächer zuschüttet.
    const perMail = await limitedSharedKey(`login-mail-addr:${hashSecret(email, env().APP_SECRET).slice(0, 32)}`, 1, 3);
    if (perMail) return perMail;
    // Der Link führt zurück auf genau die Adresse, von der die Anfrage kam (localhost, Tunnel, Vercel).
    // Die Origin ist durch checkSameOrigin geprüft, Supabase prüft sie zusätzlich gegen die Redirect-URLs.
    const origin = req.headers.get("origin");
    if (!origin) return jsonError(403, "Origin fehlt");
    await sendLoginMail(email, `${new URL(origin).origin}/konto/bestaetigen`);
    return Response.json({ ok: true });
  });
}
