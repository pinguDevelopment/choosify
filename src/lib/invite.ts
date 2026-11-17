// Einladung in eine gemeinsame Watchlist merken, während die Person sich anmeldet.
// Der Anmeldelink aus der Mail öffnet oft einen neuen Tab, deshalb localStorage statt Adresse.
const KEY = "cinemood:einladung";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function rememberInvite(token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {}
}

/** Gemerkte Einladung (höchstens einen Tag alt) holen und vergessen. */
export function takePendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown };
    if (typeof token !== "string" || !TOKEN.test(token) || typeof at !== "number" || Date.now() - at > 86400_000) return null;
    return token;
  } catch {
    return null;
  }
}
