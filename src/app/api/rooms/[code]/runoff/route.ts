import { roomAction } from "@/lib/server/room-route";
import { runoffVote } from "@/lib/server/rooms";
import { runoffSchema } from "@/lib/server/schemas";

export const POST = roomAction("runoff", runoffSchema, async ({ room, me, data }) => {
  await runoffVote(room, me, data.tmdbId);
  return Response.json({ ok: true });
});
