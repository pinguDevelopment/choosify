import { z } from "zod";
import { roomAction } from "@/lib/server/room-route";
import { startVoting } from "@/lib/server/rooms";

export const POST = roomAction("start", z.object({}), async ({ room, me }) => {
  await startVoting(room, me);
  return Response.json({ ok: true });
}, 5);
