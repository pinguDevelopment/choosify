import type { NextRequest } from "next/server";
import { checkSameOrigin, limitedShared, parseBody } from "@/lib/server/guard";
import { handle } from "@/lib/server/http";
import { createRoom } from "@/lib/server/rooms";
import { createRoomSchema } from "@/lib/server/schemas";
import { requestLocale } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const blocked = checkSameOrigin(req) ?? (await limitedShared(req, "create-room", 5, 10));
  if (blocked) return blocked;
  const body = await parseBody(req, createRoomSchema);
  if ("error" in body) return body.error;
  return handle(async () => {
    const { code } = await createRoom({ ...body.data, locale: await requestLocale() });
    return Response.json({ code }, { status: 201 });
  });
}
