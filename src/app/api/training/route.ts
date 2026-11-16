import type { NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/account";
import { checkSameOrigin, limited, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { trainingPatchSchema } from "@/lib/server/schemas";
import { resetTraining, setUseTraining, trainingProfile } from "@/lib/server/training";
import { requestLocale } from "@/lib/i18n/server";

/** „Train my Algorithm“: was Cinemood über dich gelernt hat. Ohne Anmeldung: account false. */
export async function GET(req: NextRequest) {
  const blocked = limited(req, "training", 60);
  if (blocked) return blocked;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return Response.json({ account: false }, { headers: { "Cache-Control": "no-store" } });
    return Response.json(
      { account: true, ...(await trainingProfile(account.id, await requestLocale())) },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}

/** Schalter: trainierten Geschmack in Gruppenrunden nutzen. */
export async function PATCH(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "training-write", 30));
  if (blocked) return blocked;
  const body = await parseBody(req, trainingPatchSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    await setUseTraining(account.id, body.data.useInGroups);
    return Response.json({ ok: true });
  });
}

/** Training zurücksetzen: alle eigenen Trainings-Stimmen löschen. */
export async function DELETE(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "training-write", 30));
  if (blocked) return blocked;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    await resetTraining(account.id);
    return Response.json({ ok: true });
  });
}
