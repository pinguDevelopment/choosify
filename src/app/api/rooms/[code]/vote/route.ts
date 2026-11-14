import { roomAction } from "@/lib/server/room-route";
import { vote } from "@/lib/server/rooms";
import { voteSchema } from "@/lib/server/schemas";

export const POST = roomAction("vote", voteSchema, async ({ room, me, data }) => {
  await vote(room, me, data.tmdbId, data.liked);
  return Response.json({ ok: true });
}, 120);
