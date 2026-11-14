import type { NextRequest } from "next/server";
import { checkSameOrigin, limited, parseBody } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { createRoom } from "@/lib/server/rooms";
import { createRoomSchema } from "@/lib/server/schemas";

export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? limited(req, "create-room", 5, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, createRoomSchema);
  if ("error" in body) return body.error;
  return handle(async () => Response.json(await createRoom(body.data), { status: 201 }));
}
