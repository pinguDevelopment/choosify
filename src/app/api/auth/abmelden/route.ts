import type { NextRequest } from "next/server";
import { currentAccount, endAccountSession, endAllSessions } from "@/lib/server/account";
import { checkSameOrigin, limited, parseBody } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { logoutSchema } from "@/lib/server/schemas";

export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? limited(req, "logout", 10);
  if (blocked) return blocked;
  const body = await parseBody(req, logoutSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const account = body.data.everywhere ? await currentAccount() : null;
    if (account) await endAllSessions(account.id);
    else await endAccountSession();
    return Response.json({ ok: true });
  });
}
