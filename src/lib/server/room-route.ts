import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { checkSameOrigin, limited, parseBody } from "./guard";
import { handle, jsonError } from "./http";
import { currentParticipant, loadRoom, type Participant, type Room } from "./session";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Gemeinsamer Ablauf für schreibende Raum-Endpunkte:
 * Origin-Check, Rate Limit, Raum laden, Teilnehmer per Cookie prüfen, Body validieren.
 */
export function roomAction<T>(
  name: string,
  schema: z.ZodType<T>,
  fn: (a: { room: Room; me: Participant; data: T }) => Promise<Response>,
  perMinute = 30,
) {
  return async (req: NextRequest, ctx: Ctx) => {
    const blocked = checkSameOrigin(req) ?? limited(req, name, perMinute);
    if (blocked) return blocked;
    const body = await parseBody(req, schema);
    if ("error" in body) return body.error;
    return handle(async () => {
      const room = await loadRoom((await ctx.params).code);
      if (!room) return jsonError(404, "Runde nicht gefunden");
      const me = await currentParticipant(room);
      if (!me) return jsonError(401, "Du bist dieser Runde nicht beigetreten");
      return fn({ room, me, data: body.data });
    });
  };
}
