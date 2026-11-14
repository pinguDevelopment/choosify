import { roomAction } from "@/lib/server/room-route";
import { finish } from "@/lib/server/rooms";
import { finishSchema } from "@/lib/server/schemas";

export const POST = roomAction("finish", finishSchema, async ({ room, me, data }) => {
  return Response.json(await finish(room, me, data.addToAbspann));
}, 10, true);
