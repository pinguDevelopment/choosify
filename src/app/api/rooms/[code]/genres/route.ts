import { roomAction } from "@/lib/server/room-route";
import { setGenres } from "@/lib/server/rooms";
import { genresSchema } from "@/lib/server/schemas";

export const POST = roomAction("genres", genresSchema, async ({ me, data }) => {
  await setGenres(me, data.genreIds);
  return Response.json({ ok: true });
});
