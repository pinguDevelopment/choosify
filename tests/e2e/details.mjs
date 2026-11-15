// Ende-zu-Ende-Test: Erscheinungsjahr-Filter und Detailansicht der Votekarten.
// Start: BASE=http://localhost:3100 node tests/e2e/details.mjs (SHOTS=<ordner> für Screenshots)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1, locale: "de-DE" };
const ctx = await browser.newContext(phone);
// Einführung beim ersten Swipen überspringen (die testet flow.mjs)
await ctx.addInitScript(() => localStorage.setItem("choosify:intro-gesehen", "1"));
const host = await ctx.newPage();
const log = (...a) => console.log("✓", ...a);
const cspErrors = [];
host.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text()));
const state = async (code) => (await host.request.get(`${BASE}/api/rooms/${code}`)).json();

// ---- Jahresfilter beim Erstellen ----
await host.goto(BASE);
await host.getByRole("button", { name: "Netflix", exact: true }).waitFor();
await host.getByPlaceholder("z.B. Lena").fill("Lena");
await host.getByRole("button", { name: "Eigener Zeitraum" }).click();
await host.getByLabel("von").fill("2010");
await host.getByLabel("bis").fill("2019");
if (shots) {
  await host.getByText("Aus welcher Zeit?").scrollIntoViewIfNeeded();
  await host.screenshot({ path: `${shots}/jahre-erstellen.png` });
}
await host.getByRole("button", { name: "Runde erstellen" }).click();
await host.waitForURL(/\/r\/[A-Z0-9]{10}$/);
const code = host.url().split("/").pop();
await host.getByRole("button", { name: "Action" }).click();
await host.getByRole("button", { name: /Weiter mit 1 Genre/ }).click();
await host.getByText("Erscheinungsjahr: 2010 bis 2019").waitFor();
await host.getByRole("button", { name: "Swipen starten" }).click();
await host.getByRole("button", { name: "Mehr Infos", exact: false }).first().waitFor();
const s = await state(code);
assert.ok(s.movies.length > 0, "es gibt Filme");
assert.ok(s.movies.every((m) => m.year >= 2010 && m.year <= 2019), `alle Filme 2010-2019: ${s.movies.map((m) => m.year)}`);
assert.deepEqual(s.years, { from: 2010, to: 2019 });
log(`Jahresfilter: ${s.movies.length} Filme, alle 2010 bis 2019`);

// Ungültiger Zeitraum wird vom Server abgelehnt
const bad = await host.request.post(`${BASE}/api/rooms`, {
  headers: { origin: BASE, "content-type": "application/json" },
  data: JSON.stringify({ hostName: "X", years: { from: 2020, to: 2000 } }),
});
assert.equal(bad.status(), 400, "von > bis wird abgelehnt");
log("von > bis wird abgelehnt");

// ---- Detailansicht ----
await host.waitForTimeout(400);
const top = (await state(code)).movies[0];

if (shots) await host.screenshot({ path: `${shots}/karte.png` });

// Ziehen ohne Wisch öffnet keine Details
const card = host.locator("article").last();
const box = await card.boundingBox();
await host.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
await host.mouse.down();
await host.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 3, { steps: 8 });
await host.mouse.up();
await host.waitForTimeout(600);
assert.equal(await host.getByRole("dialog").count(), 0, "Ziehen öffnet keine Details");
log("Ziehen öffnet keine Details");

// Antippen öffnet die Details
await host.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
const dialog = host.getByRole("dialog");
await dialog.waitFor();
await dialog.getByText("Regina Test").waitFor();
await dialog.getByText("Mila Berger").waitFor();
const trailer = await dialog.getByRole("link", { name: /Trailer/ }).getAttribute("href");
const imdb = await dialog.getByRole("link", { name: /IMDb/ }).getAttribute("href");
assert.match(trailer, /^https:\/\/www\.youtube\.com\/(watch\?v=trailerKEY1|results\?search_query=)/);
assert.match(imdb, /^https:\/\/www\.imdb\.com\/(title\/tt\d+\/|find\/)/);
log("Antippen zeigt Details mit Regie, Besetzung, Trailer und IMDb", trailer, imdb);
if (shots) await host.screenshot({ path: `${shots}/details.png` });

// Escape schließt, Taste I öffnet wieder
await host.keyboard.press("Escape");
await dialog.waitFor({ state: "detached" });
await host.keyboard.press("i");
await dialog.waitFor();
log("Escape schließt, Taste I öffnet");

// Abstimmen direkt aus der Detailansicht
await dialog.getByRole("button", { name: /Ja/ }).click();
await dialog.waitFor({ state: "detached" });
await host.waitForTimeout(500);
const after = await state(code);
assert.equal(after.myVotes[top.tmdbId], "yes", "Stimme aus der Detailansicht zählt");
log("Abstimmen aus der Detailansicht");

// Knopf "Mehr Infos" auf der Karte
await host.getByRole("button", { name: /^Mehr Infos zu/ }).click();
await dialog.waitFor();
await host.getByRole("button", { name: "Schließen" }).click();
await dialog.waitFor({ state: "detached" });
log("Knopf Mehr Infos");

// Unbekannte ID
assert.equal((await host.request.get(`${BASE}/api/movies/0`)).status(), 400);
assert.equal((await host.request.get(`${BASE}/api/movies/12ab`)).status(), 400);
log("Ungültige Film-IDs abgelehnt");

assert.deepEqual(cspErrors, [], "keine CSP-Verstöße");
log("Keine CSP-Verstöße");
await browser.close();
console.log("\nDetails und Jahresfilter: alles grün.");
