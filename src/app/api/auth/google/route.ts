import { NextResponse, type NextRequest } from "next/server";
import { authMock } from "@/lib/server/auth";
import { cookieBase } from "@/lib/server/cookie-opts";
import { GOOGLE_COOKIE, GOOGLE_COOKIE_MAX_AGE, isAppHash, safeNext, startGoogle } from "@/lib/server/google";
import { limited } from "@/lib/server/guard";

/**
 * Anmeldung mit Google starten (normaler Link, kein fetch).
 *  ?next=/pfad   wohin es danach geht (nur eigene Pfade, Standard /konto)
 *  ?app=<hash>   kommt von der Handy-App: SHA-256 (base64url) ihres Einmal-Geheimnisses
 */
export async function GET(req: NextRequest) {
  const blocked = limited(req, "login-google", 10, 20);
  if (blocked) return blocked;
  const q = req.nextUrl.searchParams;
  const app = q.get("app");
  try {
    const { url, cookie } = startGoogle(
      req.nextUrl.origin,
      safeNext(q.get("next")),
      isAppHash(app) ? app : null,
      authMock ? q.get("mock") : null,
    );
    const res = NextResponse.redirect(url, 303);
    res.cookies.set(GOOGLE_COOKIE, cookie, { ...cookieBase, maxAge: GOOGLE_COOKIE_MAX_AGE });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
  }
}
