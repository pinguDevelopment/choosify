import type { NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/account";
import { checkSameOrigin, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { trainingBatchSchema } from "@/lib/server/schemas";
import { trainingBatch } from "@/lib/server/training";
import { requestLocale } from "@/lib/i18n/server";

/** Nächster Stapel Filme zum Trainieren. exclude = Filme, die der Browser gerade noch im Stapel hat. */
export async function POST(req: NextRequest) {
  // Jeder Stapel kostet bis zu ~30 TMDB-Abrufe, deshalb knapper als andere Endpunkte
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "training-batch", 12, 10));
  if (blocked) return blocked;
  const body = await parseBody(req, trainingBatchSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    const movies = await trainingBatch(account.id, await requestLocale(), body.data.exclude);
    return Response.json({ movies }, { headers: { "Cache-Control": "no-store" } });
  });
}
