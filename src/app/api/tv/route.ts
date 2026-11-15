import type { NextRequest } from "next/server";
import { checkSameOrigin, limitedShared } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { createPairing } from "@/lib/server/tv";

/** Fernseher holt sich einen Kopplungscode (zeigt ihn groß an, der Host tippt ihn ins Handy). */
export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "tv-pair", 6, 6));
  if (blocked) return blocked;
  return handle(async () => Response.json(await createPairing(), { headers: { "Cache-Control": "no-store" } }));
}
