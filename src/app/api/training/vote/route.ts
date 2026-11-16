import type { NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/account";
import { checkSameOrigin, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { trainingVoteSchema } from "@/lib/server/schemas";
import { saveTrainingVote } from "@/lib/server/training";

/** Eine Stimme beim Trainieren (choice null = zurücknehmen). */
export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "training-vote", 90, 30));
  if (blocked) return blocked;
  const body = await parseBody(req, trainingVoteSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    await saveTrainingVote(account.id, body.data.tmdbId, body.data.choice);
    return Response.json({ ok: true });
  });
}
