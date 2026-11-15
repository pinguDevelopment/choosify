import { NextResponse, type NextRequest } from "next/server";
import { startAccountSession } from "@/lib/server/account";
import { redeemAppTicket } from "@/lib/server/google";
import { limitedShared } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";

/**
 * Die Handy-App löst hier das Ticket aus der Google-Anmeldung ein (POST aus der WebView heraus),
 * damit die Konto-Sitzung im Cookie der App landet und nicht im Browser.
 * Nur aus der App: Ein normaler Browser schickt das App-Kennzeichen im User-Agent nicht mit,
 * so kann keine fremde Seite jemanden heimlich in ein anderes Konto einloggen.
 */
export async function POST(req: NextRequest) {
  const blocked = await limitedShared(req, "login-app", 10, 15);
  if (blocked) return blocked;
  const origin = req.nextUrl.origin;
  const fail = () => NextResponse.redirect(new URL("/konto?google=fehler", origin), 303);
  if (!/\bCinemoodApp\//.test(req.headers.get("user-agent") ?? "")) return fail();
  const form = await req.formData().catch(() => null);
  const ticket = form?.get("ticket");
  const secret = form?.get("secret");
  if (typeof ticket !== "string" || typeof secret !== "string") return fail();
  const user = redeemAppTicket(ticket, secret);
  if (!user) return fail();
  return handle(async () => {
    await startAccountSession(user.userId, user.email);
    return NextResponse.redirect(new URL("/konto?google=1", origin), 303);
  });
}
