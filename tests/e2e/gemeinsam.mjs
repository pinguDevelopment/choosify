// Ende-zu-Ende-Test: gemeinsame Watchlist mit zwei Konten, eigene Watchlist bleibt daneben.
// Braucht AUTH_MOCK=1 und TMDB_MOCK=1 auf dem Server (Code ist dann immer 123456).
// Start: BASE=http://localhost:3100 node tests/e2e/gemeinsam.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "de-DE" };
const log = (...a) => console.log("✓", ...a);
const newDevice = async () => (await browser.newContext(phone)).newPage();
const stamp = Date.now();
const json = (page, path, method = "GET", body) =>
  page.request
    .fetch(`${BASE}${path}`, {
      method,
      headers: { origin: BASE, "accept-language": "de-DE", ...(body ? { "content-type": "application/json" } : {}) },
      data: body ? JSON.stringify(body) : undefined,
    })
    .then(async (r) => ({ status: r.status(), body: await r.json().catch(() => ({})) }));

async function login(page, email, start = `${BASE}/konto`) {
  if (start) await page.goto(start);
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmelde-Link schicken" }).click();
  await page.getByLabel("Code aus der Mail").fill("123456");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
}

const titles = async (page) => (await json(page, "/api/abspann")).body.movies.map((m) => m.title);

// ---- Lena: eigene Crew per Runde, dann gemeinsame Watchlist „Wir zwei“ anlegen ----
const lena = await newDevice();
await login(lena, `lena.${stamp}@example.org`);
await lena.getByText("Angemeldet als").waitFor();
assert.equal((await json(lena, "/api/rooms", "POST", { hostName: "Lena", providerIds: [8] })).status, 201);
const hits = (await json(lena, "/api/tmdb/search?q=Testfilm")).body.results;
assert.ok(hits.length >= 3);
assert.equal((await json(lena, "/api/abspann", "POST", { tmdbId: hits[0].tmdbId })).status, 201);
const own = await titles(lena);
log("Lena hat eine eigene Watchlist:", own.join(", "));

await lena.reload();
await lena.getByPlaceholder("z.B. Wir zwei").fill("Wir zwei");
await lena.getByRole("button", { name: "Anlegen" }).click();
await lena.getByRole("radio", { name: /Wir zwei/ }).and(lena.locator("[aria-checked=true]")).waitFor();
assert.deepEqual(await titles(lena), [], "neue Watchlist ist leer");
log("Gemeinsame Watchlist angelegt und ausgewählt");

// Einladungslink über die Oberfläche
await lena.locator("li", { hasText: "Wir zwei" }).getByRole("button", { name: "Teilen & verwalten" }).click();
await lena.getByRole("button", { name: "Einladungslink erstellen" }).click();
const link = await lena.getByRole("textbox", { name: "Jemanden einladen" }).inputValue();
assert.match(link, /\/einladung\/[A-Za-z0-9_-]{43}$/);
await lena.getByAltText("QR-Code zum Einladen").waitFor();
if (shots) await lena.screenshot({ path: `${shots}/konto-teilen.png`, fullPage: true });
log("Einladungslink mit QR-Code erstellt");

// Fremde und falsche Links
const stranger = await newDevice();
assert.equal((await json(stranger, `/api/einladung/${"x".repeat(43)}`)).status, 404);
const crewId = (await json(lena, "/api/konto")).body.account.crews.find((c) => c.name === "Wir zwei").id;
assert.equal((await json(stranger, `/api/crews/${crewId}`)).status, 401);

// ---- Mia öffnet den Link ohne Konto, meldet sich an und landet wieder bei der Einladung ----
const mia = await newDevice();
await mia.goto(link);
await mia.getByRole("heading", { name: "Einladung zur Watchlist „Wir zwei“" }).waitFor();
await mia.getByRole("link", { name: "Anmelden" }).click();
await mia.waitForURL(/\/konto$/);
await login(mia, `mia.${stamp}@example.org`, null);
await mia.waitForURL(/\/einladung\//);
await mia.getByRole("button", { name: "Beitreten" }).click();
await mia.getByText("Du bist schon dabei.").waitFor();
log("Mia ist über den Link beigetreten");

// Mia hatte vorher keine eigene Crew: Jetzt ist „Wir zwei“ ihre aktive Watchlist
assert.equal((await json(mia, "/api/abspann", "POST", { tmdbId: hits[1].tmdbId })).status, 201);
assert.deepEqual(await titles(lena), [hits[1].title], "Lena sieht Mias Film");
log("Beide sehen dieselbe Watchlist");

// Mia legt sich zusätzlich eine eigene an: beide laufen parallel
assert.equal((await json(mia, "/api/crews", "POST", { name: "Nur ich" })).status, 201);
assert.equal((await json(mia, "/api/abspann", "POST", { tmdbId: hits[2].tmdbId })).status, 201);
assert.deepEqual(await titles(mia), [hits[2].title]);
assert.deepEqual(await titles(lena), [hits[1].title], "Mias eigene Watchlist bleibt privat");

// Umschalten auf der Watchlist-Seite
await mia.goto(`${BASE}/watchlist`);
await mia.getByText("Welche Watchlist?").waitFor();
await mia.getByRole("radio", { name: /Wir zwei/ }).click();
await mia.getByRole("heading", { name: /Wir zwei/ }).waitFor();
await mia.getByText(hits[1].title).waitFor();
if (shots) await mia.screenshot({ path: `${shots}/watchlist-umschalten.png`, fullPage: true });
log("Eigene und gemeinsame Watchlist parallel, Umschalten klappt");

// Mitglieder: Lena sieht Mia (nur Teil vor dem @), Mia darf Lena nicht entfernen
const details = (await json(mia, `/api/crews/${crewId}`)).body;
assert.equal(details.members.length, 2);
assert.ok(details.members.some((m) => m.name === `lena.${stamp}` && m.owner));
const lenaId = details.members.find((m) => m.owner).id;
const miaId = details.members.find((m) => m.me).id;
assert.equal((await json(mia, `/api/crews/${crewId}`, "PATCH", { removeMember: lenaId })).status, 403);

// Link stoppen: dann funktioniert er nicht mehr
assert.equal((await json(lena, `/api/crews/${crewId}`, "PATCH", { invite: "stop" })).status, 200);
assert.equal((await json(stranger, `/api/einladung/${link.split("/").pop()}`)).status, 404);
log("Rechte und Link-Stopp geprüft");

// Lena entfernt Mia: Mia hat dann nur noch ihre eigene
assert.equal((await json(lena, `/api/crews/${crewId}`, "PATCH", { removeMember: miaId })).status, 200);
const miaCrews = (await json(mia, "/api/konto")).body.account.crews.map((c) => c.name);
assert.deepEqual(miaCrews, ["Nur ich"]);
assert.equal((await json(mia, `/api/crews/${crewId}`)).status, 404);
log("Mitglied entfernt");

// Löschen: Mitglieder dürfen nicht, wer sie angelegt hat schon (über die Oberfläche, mit Rückfrage)
const again = (await json(lena, `/api/crews/${crewId}`, "PATCH", { invite: "new" })).body.invite.token;
assert.equal((await json(mia, `/api/einladung/${again}`, "POST", {})).status, 200);
assert.equal((await json(mia, `/api/crews/${crewId}`, "DELETE", {})).status, 403);
await lena.goto(`${BASE}/konto`);
const row = lena.locator("li", { hasText: "Wir zwei" });
await row.getByRole("button", { name: "Teilen & verwalten" }).click();
await row.getByRole("button", { name: "Watchlist löschen" }).click();
await row.getByRole("button", { name: "Wirklich löschen? Nochmal tippen" }).click();
await lena.getByRole("radio", { name: /Wir zwei/ }).waitFor({ state: "detached" });
assert.deepEqual((await json(lena, "/api/konto")).body.account.crews.map((c) => c.name), ["Crew von Lena"]);
assert.deepEqual((await json(mia, "/api/konto")).body.account.crews.map((c) => c.name), ["Nur ich"]);
assert.deepEqual(await titles(lena), own, "Lenas eigene Watchlist ist wieder aktiv");
// Eigene Watchlist ganz allein löschen geht auch
assert.equal((await json(mia, "/api/konto")).body.account.crews.length, 1);
const miaOwn = (await json(mia, "/api/konto")).body.account.crews[0].id;
assert.equal((await json(mia, `/api/crews/${miaOwn}`, "DELETE", {})).status, 200);
assert.deepEqual((await json(mia, "/api/konto")).body.account.crews, []);
log("Watchlists löschen: nur wer sie angelegt hat, mit Rückfrage");

// Alte Adresse /abspann leitet auf /watchlist weiter
await lena.goto(`${BASE}/abspann`);
await lena.waitForURL(/\/watchlist$/);
await lena.getByRole("heading", { name: "Watchlist", exact: true }).waitFor();
log("/abspann leitet auf /watchlist um");

await browser.close();
