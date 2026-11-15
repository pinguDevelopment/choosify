import { NextResponse, type NextRequest } from "next/server";
import { startAccountSession } from "@/lib/server/account";
import { GOOGLE_COOKIE, appTicket, decodeState, finishGoogle } from "@/lib/server/google";
import { dbReady } from "@/lib/server/db";
import { limited } from "@/lib/server/guard";

/** Rücksprung von Google (über Supabase): Code einlösen und anmelden bzw. zurück an die Handy-App. */
export async function GET(req: NextRequest) {
  const blocked = limited(req, "login-google", 10, 20);
  if (blocked) return blocked;
  const q = req.nextUrl.searchParams;
  const state = decodeState(req.cookies.get(GOOGLE_COOKIE)?.value);
  const code = q.get("code");
  const origin = req.nextUrl.origin;

  const done = (res: Response) => {
    // Prüfwert gilt nur einmal
    const out = res instanceof NextResponse ? res : new NextResponse(res.body, res);
    out.cookies.delete({ name: GOOGLE_COOKIE, path: "/" });
    out.headers.set("Cache-Control", "no-store");
    out.headers.set("Referrer-Policy", "no-referrer");
    return out;
  };
  const failed = () => {
    if (state?.app) return done(backToApp("cinemood://anmelden?fehler=1"));
    const target = new URL(state?.next ?? "/konto", origin);
    target.searchParams.set("google", "fehler");
    return done(NextResponse.redirect(target, 303));
  };

  // Abgebrochen (z. B. Kontoauswahl geschlossen) oder Cookie weg (zu lange gewartet, anderer Browser)
  if (!state || !code || q.get("error")) return failed();

  try {
    await dbReady();
    const user = await finishGoogle(code, state);
    if (state.app) {
      const ticket = appTicket(user.userId, user.email, state.app);
      return done(backToApp(`cinemood://anmelden?ticket=${encodeURIComponent(ticket)}`));
    }
    await startAccountSession(user.userId, user.email);
    const target = new URL(state.next, origin);
    target.searchParams.set("google", "1");
    return done(NextResponse.redirect(target, 303));
  } catch (err) {
    if (!(err instanceof Error && "status" in err)) console.error(err);
    return failed();
  }
}

/**
 * Zurück in die Handy-App. Direkte Weiterleitung auf cinemood://, wie es auch AppAuth macht:
 * Custom Tabs (Chrome, Samsung Internet) geben solche Links an die App weiter.
 */
function backToApp(url: string): Response {
  return NextResponse.redirect(url, 303);
}
