import { roomAction } from "@/lib/server/room-route";
import { addWinnerToAbspann, finish } from "@/lib/server/rooms";
import { finishSchema } from "@/lib/server/schemas";

export const POST = roomAction("finish", finishSchema, async ({ room, me, data }) => {
  await finish(room, me, data.winnerTmdbId);
  if (data.addToAbspann && data.winnerTmdbId) await addWinnerToAbspann(room, data.winnerTmdbId);
  return Response.json({ ok: true });
}, 10, true);
