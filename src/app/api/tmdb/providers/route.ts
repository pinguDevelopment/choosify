import type { NextRequest } from "next/server";
import { getProviders } from "@/lib/server/tmdb";
import { jsonError, serverError } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") ?? "DE";
  if (!/^[A-Z]{2}$/.test(region)) return jsonError(400, "Ungültige Region");
  try {
    return Response.json({ providers: await getProviders(region) });
  } catch (err) {
    return serverError(err);
  }
}
