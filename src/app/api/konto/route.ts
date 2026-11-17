import type { NextRequest } from "next/server";
import {
  accountCrews,
  currentAccount,
  MAX_CREWS_PER_ACCOUNT,
  saveFavorites,
  selectCrew,
} from "@/lib/server/account";
import { db } from "@/lib/server/db";
import { checkSameOrigin, limited, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { accountPatchSchema } from "@/lib/server/schemas";
import { currentCrew, deviceCrew } from "@/lib/server/session";
import { googleEnabled } from "@/lib/server/google";

/** Anmeldestatus, Favoriten und Crews des Kontos. */
export async function GET(req: NextRequest) {
  const blocked = limited(req, "konto", 60);
  if (blocked) return blocked;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) {
      // Google-Knopf nur, wenn Google bei Supabase eingeschaltet ist. In der Fernseher-App nie:
      // Google lässt die Anmeldung dort (eingebettete WebView) nicht zu.
      const tvApp = /\bCinemoodTV\//.test(req.headers.get("user-agent") ?? "");
      const google = !tvApp && (await googleEnabled());
      return Response.json({ account: null, google }, { headers: { "Cache-Control": "no-store" } });
    }
    const [crews, active, device] = await Promise.all([accountCrews(account.id), currentCrew(), deviceCrew()]);
    return Response.json(
      {
        account: {
          email: account.email,
          favorites: account.favorites,
          crews: crews.map((c) => ({ id: c.id, name: c.name, owner: c.owner, members: c.members, active: c.id === active?.id })),
          // Crew von diesem Gerät, die noch keinem Konto gehört: kann übernommen werden.
          deviceCrew: device && !device.account_id ? { name: device.name } : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}

/** Favoriten speichern, aktive Crew wählen oder die Crew dieses Geräts ins Konto übernehmen. */
export async function PATCH(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "konto-write", 30, 40));
  if (blocked) return blocked;
  const body = await parseBody(req, accountPatchSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const account = await currentAccount();
    if (!account) return jsonError(401, "Nicht angemeldet");
    const { favorites, crewId, adoptDeviceCrew } = body.data;

    if (favorites) await saveFavorites(account.id, { ids: [...new Set(favorites.ids)], other: favorites.other });

    if (adoptDeviceCrew) {
      // Nur mit gültigem Crew-Cookie dieses Geräts und nur, wenn die Crew noch niemandem gehört.
      const device = await deviceCrew();
      if (!device || device.account_id) return jsonError(409, "Auf diesem Gerät gibt es keine Crew zum Übernehmen");
      const crews = await accountCrews(account.id);
      if (crews.length >= MAX_CREWS_PER_ACCOUNT) return jsonError(409, "Dein Konto hat schon die maximale Zahl an Crews");
      await db().updateTable("crews").set({ account_id: account.id }).where("id", "=", device.id).where("account_id", "is", null).execute();
      await selectCrew(device.id);
    }

    if (crewId) {
      const crews = await accountCrews(account.id);
      if (!crews.some((c) => c.id === crewId)) return jsonError(404, "Crew nicht gefunden");
      await selectCrew(crewId);
    }
    return Response.json({ ok: true });
  });
}
