import type { NextRequest } from "next/server";
import { checkSameOrigin, clientIp, limited, limitedSharedKey, parseBody } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { rate, ratingPage } from "@/lib/server/ratings";
import { rateSchema } from "@/lib/server/schemas";

// Bewerten per Link oder QR-Code, ohne Konto. Der Link ist signiert (siehe tokens.ts).

export async function GET(req: NextRequest, ctx: RouteContext<"/api/bewerten/[token]">) {
  const blocked = limited(req, "rate-read", 60);
  if (blocked) return blocked;
  const { token } = await ctx.params;
  return handle(async () => Response.json(await ratingPage(token)));
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/bewerten/[token]">) {
  // Limit pro Person (Bewerter-Cookie), sonst pro IP: eine Gruppe im selben WLAN teilt sich die IP.
  const who = req.cookies.get("fa_rater")?.value?.slice(0, 22);
  const blocked =
    checkSameOrigin(req) ??
    limited(req, "rate-write", 20) ??
    (await limitedSharedKey(`rate:${who ? `r:${who}` : `ip:${clientIp(req)}`}`, 10, 15));
  if (blocked) return blocked;
  const body = await parseBody(req, rateSchema);
  if ("error" in body) return body.error;
  const { token } = await ctx.params;
  return handle(async () => {
    await rate(token, body.data.name, body.data.stars);
    return Response.json(await ratingPage(token));
  });
}
