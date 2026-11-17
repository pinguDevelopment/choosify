import type { NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/account";
import { createCrew } from "@/lib/server/crews";
import { checkSameOrigin, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { crewCreateSchema } from "@/lib/server/schemas";

/** Neue Crew anlegen, z. B. für eine gemeinsame Watchlist mit der Partnerin. Nur mit Konto. */
export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "crew-write", 10, 15));
  if (blocked) return blocked;
  const body = await parseBody(req, crewCreateSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    const id = await createCrew(account.id, body.data.name);
    return Response.json({ id }, { status: 201 });
  });
}
