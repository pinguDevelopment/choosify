// Ende-zu-Ende-Test: Anmeldung mit Google im Browser und in der Handy-App (Ticket über cinemood://).
// Braucht AUTH_MOCK=1 auf dem Server: Statt Google geht es direkt zurück, die Adresse kommt aus ?mock=.
// Start: BASE=http://localhost:3100 node tests/e2e/google.mjs
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "de-DE" };
const appUa = "Mozilla/5.0 (Linux; Android 14; SM-S921B; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 CinemoodApp/1.0.1";
const log = (...a) => console.log("✓", ...a);
const email = `google.${Date.now()}@example.org`;
const konto = async (page) => (await (await page.request.get(`${BASE}/api/konto`)).json());

// ---- Browser: Knopf ist da, Anmeldung klappt, Favoriten vom Gerät landen im Konto ----
const web = await (await browser.newContext(phone)).newPage();
await web.goto(`${BASE}/konto`);
const button = web.getByRole("link", { name: "Mit Google anmelden" });
await button.waitFor();
assert.equal(await button.getAttribute("href"), "/api/auth/google?next=/konto");
if (shots) await web.screenshot({ path: `${shots}/google-knopf.png` });
await web.evaluate(() => localStorage.setItem("choosify:lieblingsquellen", JSON.stringify({ ids: [8], other: false })));
await web.goto(`${BASE}/api/auth/google?next=/konto&mock=${encodeURIComponent(email)}`);
await web.getByText("Angemeldet als").waitFor();
await web.getByText(email).waitFor();
assert.equal(new URL(web.url()).search, "", "?google=1 wird aus der Adresse entfernt");
log("Browser: mit Google angemeldet");

// Abgebrochen bei Google: zurück auf /konto mit Hinweis
const web2 = await (await browser.newContext(phone)).newPage();
// Nur den Start (setzt das Prüfwert-Cookie), ohne der Weiterleitung zu folgen
await web2.request.get(`${BASE}/api/auth/google?next=/konto&mock=x@example.org`, { maxRedirects: 0 });
await web2.goto(`${BASE}/api/auth/google/zurueck?error=access_denied`);
await web2.getByText(/hat nicht geklappt/).waitFor();
log("Abbruch zeigt Hinweis");

// Ohne Cookie (anderer Browser) wird ein Code nicht angenommen
const res = await web2.request.get(`${BASE}/api/auth/google/zurueck?code=mock.abc.${Buffer.from(email).toString("base64url")}`, { maxRedirects: 0 });
assert.equal(res.status(), 303);
assert.match(res.headers().location, /google=fehler/);
log("Code ohne Prüfwert-Cookie abgelehnt");

// Fremde Rücksprungziele werden ignoriert
const evil = await web2.request.get(`${BASE}/api/auth/google?next=//evil.example&mock=a@b.de`, { maxRedirects: 0 });
const back = await web2.request.get(evil.headers().location, { maxRedirects: 0 });
assert.equal(new URL(back.headers().location).host, new URL(BASE).host);
log("Kein offener Redirect über next");

// ---- Handy-App ----
// Die App erzeugt ein Geheimnis und öffnet die Anmeldung im Browser (Custom Tab) nur mit dessen Hash.
const secret = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(secret).digest("base64url");
const tab = await (await browser.newContext(phone)).newPage();
const start = await tab.request.get(`${BASE}/api/auth/google?app=${hash}&next=/konto&mock=${encodeURIComponent(email)}`, { maxRedirects: 0 });
const cb = await tab.request.get(start.headers().location, { maxRedirects: 0 });
const link = cb.headers().location;
assert.match(link, /^cinemood:\/\/anmelden\?ticket=/, "Browser springt zurück in die App");
const ticket = new URL(link).searchParams.get("ticket");
assert.equal((await konto(tab)).account, null, "Im Browser selbst ist niemand angemeldet");
log("Custom Tab bekommt Ticket für die App");

// Die App löst das Ticket in ihrer WebView ein
const app = await (await browser.newContext({ ...phone, userAgent: appUa })).newPage();
const post = (ctx, form) => ctx.request.post(`${BASE}/api/auth/app`, { form, maxRedirects: 0 });
let r = await post(app, { ticket, secret: "falsch" });
assert.match(r.headers().location, /google=fehler/);
assert.equal((await konto(app)).account, null);
log("Falsches App-Geheimnis abgelehnt");

const plain = await (await browser.newContext(phone)).newPage();
r = await post(plain, { ticket, secret });
assert.match(r.headers().location, /google=fehler/);
assert.equal((await konto(plain)).account, null);
log("Ticket außerhalb der App abgelehnt");

r = await post(app, { ticket, secret });
assert.equal(r.status(), 303);
assert.match(r.headers().location, /\/konto\?google=1$/);
const acc = (await konto(app)).account;
assert.equal(acc.email, email);
assert.deepEqual(acc.favorites.ids, [8], "Gleiche Adresse = gleiches Konto wie im Browser");
log("App: mit Google angemeldet, gleiches Konto");

// Fernseher-App zeigt keinen Google-Knopf (Google blockt dort die Anmeldung)
const tv = await (await browser.newContext({ ...phone, userAgent: "Mozilla/5.0 CinemoodTV/1.0.6" })).newPage();
assert.equal((await konto(tv)).google, false);
assert.equal((await konto(plain)).google, true);
log("Kein Google-Knopf in der Fernseher-App");

await browser.close();
console.log("Google-Test bestanden");
