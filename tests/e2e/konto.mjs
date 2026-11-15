// Ende-zu-Ende-Test: Login per Magic-Link/Code, Crew auf zwei Geräten.
// Braucht AUTH_MOCK=1 und TMDB_MOCK=1 auf dem Server (Code ist dann immer 123456).
// Start: BASE=http://localhost:3100 node tests/e2e/konto.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "de-DE" };
const log = (...a) => console.log("✓", ...a);
const newDevice = async () => (await browser.newContext(phone)).newPage();
const email = `lena.${Date.now()}@example.org`;
const json = (page, path, method = "GET", body) =>
  page.request
    .fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "content-type": "application/json", origin: BASE } : { origin: BASE },
      data: body ? JSON.stringify(body) : undefined,
    })
    .then(async (r) => ({ status: r.status(), body: await r.json().catch(() => ({})) }));

async function createRoom(page, name) {
  await page.goto(BASE);
  // Erst warten, bis die Seite interaktiv ist (Dienste geladen), sonst geht der Name beim Hydrieren verloren
  await page.getByRole("button", { name: "Netflix", exact: true }).waitFor();
  await page.getByPlaceholder("z.B. Lena").fill(name);
  await page.getByRole("button", { name: "Runde erstellen" }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{10}$/);
}

async function loginWithCode(page) {
  await page.goto(`${BASE}/konto`);
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmelde-Link schicken" }).click();
  await page.getByText("Schau in dein Postfach").waitFor();
  await page.getByLabel("Code aus der Mail").fill("123456");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.getByText("Angemeldet als").waitFor();
}

// ---- Gerät A: Crew ohne Konto, dann anmelden und Crew übernehmen ----
const a = await newDevice();
await createRoom(a, "Lena");
await a.goto(BASE);
await a.getByRole("button", { name: "Netflix als Favorit" }).click();
const hits = (await json(a, "/api/tmdb/search?q=Testfilm")).body.results;
assert.equal((await json(a, "/api/abspann", "POST", { tmdbId: hits[0].tmdbId })).status, 201);
log("Gerät A hat eine Crew ohne Konto");

// Falscher Code wird abgelehnt
await a.goto(`${BASE}/konto`);
await a.getByLabel("E-Mail-Adresse").fill(email);
await a.getByRole("button", { name: "Anmelde-Link schicken" }).click();
await a.getByLabel("Code aus der Mail").fill("654321");
await a.getByRole("button", { name: "Anmelden", exact: true }).click();
await a.getByText(/ungültig oder abgelaufen/).waitFor();
log("Falscher Code abgelehnt");

await a.getByLabel("Code aus der Mail").fill("123456");
await a.getByRole("button", { name: "Anmelden", exact: true }).click();
await a.getByText("Angemeldet als").waitFor();
await a.getByText("Crew von diesem Gerät übernehmen?").waitFor();
if (shots) await a.screenshot({ path: `${shots}/konto-1-uebernehmen.png`, fullPage: true });
await a.getByRole("button", { name: "Ins Konto übernehmen" }).click();
await a.getByRole("radio", { name: /Crew von Lena/ }).waitFor();
assert.equal(await a.getByText("Crew von diesem Gerät übernehmen?").count(), 0);
log("Gerät A: per Code angemeldet, Crew ins Konto übernommen");
if (shots) await a.screenshot({ path: `${shots}/konto-2-angemeldet.png`, fullPage: true });

// ---- Gerät B: neu, ohne Crew, Anmeldung per Magic-Link ----
const b = await newDevice();
assert.equal((await json(b, "/api/abspann")).body.crew, null, "Gerät B hat noch keine Crew");
// Den Link schreibt AUTH_MOCK ins Server-Log, Format wie in src/lib/server/auth.ts.
await json(b, "/api/auth/mail", "POST", { email });
const tokenHash = `mock.${Buffer.from(email).toString("base64url")}`;
// Über die Startseite: Rückfall, falls Supabase den Link auf die Site-URL umbiegt.
await b.goto(`${BASE}/?token_hash=${tokenHash}&type=email`);
await b.getByRole("button", { name: "Jetzt anmelden" }).waitFor();
await b.waitForURL((u) => !u.href.includes("token_hash")); // Token verschwindet aus der Adresszeile
if (shots) await b.screenshot({ path: `${shots}/konto-3-link.png` });
await b.getByRole("button", { name: "Jetzt anmelden" }).click();
await b.waitForURL(/\/konto$/);
await b.getByRole("radio", { name: /Crew von Lena/ }).waitFor();
const abB = (await json(b, "/api/abspann")).body;
assert.equal(abB.crew?.name, "Crew von Lena");
assert.ok(abB.movies.some((m) => m.tmdbId === hits[0].tmdbId), "Abspann ist auf Gerät B da");
log("Gerät B: per Magic-Link angemeldet, Crew und Abspann sind da");

// Favoriten kommen aus dem Konto
await b.goto(BASE);
await b.getByText("Angemeldet als").waitFor();
await b.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed="true"]')].some((x) => x.textContent?.includes("Netflix")));
log("Favoriten auf Gerät B synchron");
if (shots) await b.screenshot({ path: `${shots}/konto-4-start.png` });

// Runde auf Gerät B nutzt dieselbe Crew, ohne Crew-Cookie auf dem Gerät zu hinterlassen
await createRoom(b, "Lena");
const cookiesB = await b.context().cookies();
assert.ok(!cookiesB.some((c) => c.name === "fa_crew"), "kein Crew-Cookie auf Gerät B");
assert.ok(cookiesB.find((c) => c.name === "fa_acc")?.httpOnly, "Konto-Cookie ist httpOnly");
log("Gerät B startet Runde mit der Konto-Crew");

// ---- Gerät C: eigene Crew, nach Anmeldung zwei Crews und Wechsel ----
const c = await newDevice();
await createRoom(c, "Ben");
await loginWithCode(c);
await c.getByRole("button", { name: "Ins Konto übernehmen" }).click();
await c.getByRole("radio", { name: /Crew von Ben/ }).waitFor();
assert.equal(await c.getByRole("radio").count(), 2);
await c.getByRole("radio", { name: /Crew von Lena/ }).click();
await c.waitForFunction(() => document.querySelector('[role=radio][aria-checked="true"]')?.textContent?.includes("Lena"));
assert.equal((await json(c, "/api/abspann")).body.crew.name, "Crew von Lena");
log("Zwei Crews im Konto, Wechsel funktioniert");

// ---- Sicherheit ----
const stranger = await newDevice();
assert.equal((await json(stranger, "/api/konto", "PATCH", { adoptDeviceCrew: true })).status, 401, "ohne Login");
const foreign = await json(c, "/api/konto", "PATCH", { crewId: "00000000-0000-4000-8000-000000000000" });
assert.equal(foreign.status, 404, "fremde Crew nicht wählbar");
const xsite = await c.request.fetch(`${BASE}/api/auth/mail`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://evil.example" },
  data: JSON.stringify({ email }),
});
assert.equal(xsite.status(), 403, "fremde Origin");
assert.equal((await json(stranger, "/api/auth/mail", "POST", { email: "kein-mail" })).status, 400, "ungültige Adresse");
assert.equal((await json(stranger, "/api/auth/bestaetigen", "POST", { tokenHash: "mock.xxxxxxxxxx" })).status, 400, "falscher Link");
log("Sicherheitschecks bestanden");

// ---- Abmelden ----
await b.goto(`${BASE}/konto`);
await b.getByRole("button", { name: "Abmelden", exact: true }).click();
await b.getByRole("button", { name: "Anmelde-Link schicken" }).waitFor();
assert.equal((await json(b, "/api/abspann")).body.crew, null, "nach dem Abmelden keine Crew mehr auf Gerät B");
// Gerät A ist noch angemeldet; "überall abmelden" beendet auch A
assert.ok((await json(a, "/api/konto")).body.account);
await c.goto(`${BASE}/konto`);
await c.getByRole("button", { name: "Auf allen Geräten abmelden" }).click();
await c.getByRole("button", { name: "Anmelde-Link schicken" }).waitFor();
assert.equal((await json(a, "/api/konto")).body.account, null, "Gerät A ist auch abgemeldet");
// Gerät A hat seine Crew aber noch per Crew-Cookie (wie vor dem Login)
assert.equal((await json(a, "/api/abspann")).body.crew?.name, "Crew von Lena");
log("Abmelden (einzeln und überall) funktioniert");

// Rate Limit auf Anmelde-Mails pro Adresse
const other = `flut.${Date.now()}@example.org`;
const statuses = [];
for (let i = 0; i < 5; i++) statuses.push((await json(await newDevice(), "/api/auth/mail", "POST", { email: other })).status);
assert.ok(statuses.includes(429), `Mail-Limit greift (${statuses})`);
log("Mail-Limit pro Adresse greift");

await browser.close();
console.log("\nKonto: alles grün.");
