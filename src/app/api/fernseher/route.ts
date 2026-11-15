import type { NextRequest } from "next/server";
import { checkSameOrigin, limited, limitedShared, parseBody } from "@/lib/server/guard";
import { handle, jsonError } from "@/lib/server/http";
import { tvSettingsSchema } from "@/lib/server/schemas";
import { currentCrew } from "@/lib/server/session";
import { loadTvSettings, removeTv, renewTvLink, saveTvSettings } from "@/lib/server/tv";
import { z } from "zod";

// Fernseher-Link der aktiven Crew einrichten. Wer die Crew hat (Crew-Cookie oder Konto), darf das.
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: NextRequest) {
  const blocked = limited(req, "fernseher", 60);
  if (blocked) return blocked;
  return handle(async () => {
    const crew = await currentCrew();
    if (!crew) return Response.json({ crew: null, tv: null }, noStore);
    return Response.json({ crew: { name: crew.name }, tv: await loadTvSettings(crew.id) }, noStore);
  });
}

async function write<T>(req: NextRequest, schema: z.ZodType<T>, fn: (crewId: string, data: T) => Promise<unknown>) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "fernseher-write", 20, 20));
  if (blocked) return blocked;
  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const crew = await currentCrew();
    if (!crew) return jsonError(403, "Auf diesem Gerät gibt es noch keine Crew. Starte zuerst eine Runde.");
    return Response.json({ tv: (await fn(crew.id, body.data)) ?? null }, noStore);
  });
}

/** Dienste speichern (legt den Link beim ersten Mal an). */
export const PUT = (req: NextRequest) => write(req, tvSettingsSchema, (id, d) => saveTvSettings(id, d.providerIds, d.anySource));
/** Neuen Link erzeugen, der alte hört auf zu gehen. */
export const POST = (req: NextRequest) => write(req, z.object({}), (id) => renewTvLink(id));
/** Fernseher-Link ausschalten. */
export const DELETE = (req: NextRequest) => write(req, z.object({}), (id) => removeTv(id));
