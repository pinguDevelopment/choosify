// Ende-zu-Ende-Test: Host + 2 Gäste spielen eine komplette Runde durch.
// Start: BASE=http://localhost:3100 node tests/e2e/flow.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 };
const host = await (await browser.newContext(phone)).newPage();
const guests = [await (await browser.newContext(phone)).newPage(), await (await browser.newContext(phone)).newPage()];
const log = (...a) => console.log("✓", ...a);

// Host erstellt Runde mit Netflix
await host.goto(BASE);
await host.getByPlaceholder("z.B. Lena").fill("Lena");
await host.getByRole("button", { name: "Netflix" }).click();
if (shots) await host.screenshot({ path: `${shots}/1-start.png` });
await host.getByRole("button", { name: "Runde erstellen" }).click();
await host.waitForURL(/\/r\/[A-Z0-9]{10}$/);
const url = host.url();
const code = url.split("/").pop();
log("Runde erstellt", code);
await host.getByRole("img", { name: /QR-Code/ }).waitFor();
log("QR-Code sichtbar");

// Host wählt Genres
await host.getByRole("button", { name: "Action" }).click();
await host.getByRole("button", { name: "Komödie" }).click();
if (shots) await host.screenshot({ path: `${shots}/2-genres.png`, fullPage: true });
await host.getByRole("button", { name: /Weiter mit 2 Genres/ }).click();

// Gäste joinen über den Link (= QR-Code)
for (const [i, g] of guests.entries()) {
  await g.goto(url);
  await g.getByPlaceholder("Dein Name").fill(["Ben", "Cem"][i]);
  await g.getByRole("button", { name: "Beitreten" }).click();
  await g.getByRole("button", { name: "Action" }).click();
  await g.getByRole("button", { name: /Weiter mit/ }).click();
  await g.getByText("Warte, bis der Host startet").waitFor();
}
log("2 Gäste beigetreten und Genres gewählt");

// Doppelter Name wird abgelehnt
const dupe = await (await browser.newContext(phone)).newPage();
await dupe.goto(url);
await dupe.getByPlaceholder("Dein Name").fill("ben");
await dupe.getByRole("button", { name: "Beitreten" }).click();
await dupe.getByText("Dieser Name ist schon vergeben").waitFor();
log("Doppelter Name abgelehnt");

await host.getByText("3 bereit").waitFor({ timeout: 8000 });
if (shots) await host.screenshot({ path: `${shots}/3-lobby.png`, fullPage: true });
await host.getByRole("button", { name: "Swipen starten" }).click();
await host.getByRole("button", { name: "Ja" }).waitFor();
log("Swipen gestartet");

// Alle stimmen ab: jeder sagt Ja zum 1. und 3. Film, Lena auch zum 2.
async function swipeAll(page, yesAt) {
  const [done, total] = (await page.getByText(/^\d+\/\d+$/).first().textContent()).split("/").map(Number);
  for (let i = done; i < total; i++) {
    await page.getByRole("button", { name: yesAt.includes(i) ? "Ja" : "Nein" }).click({ timeout: 5000 }).catch(async (e) => { await page.screenshot({ path: "/var/tmp/fa-fail.png" }); console.log("fail at", i, "of", total); throw e; });
  }
  await page.getByText("Du bist durch!").waitFor();
  return total;
}
for (const g of guests) await g.getByRole("button", { name: "Ja" }).waitFor({ timeout: 8000 });
if (shots) await guests[0].screenshot({ path: `${shots}/4-swipe.png` });
// Ein Swipe per Drag (Touch-Geste) testen
const card = guests[0].locator("article").last();
const box = await card.boundingBox();
await guests[0].mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await guests[0].mouse.down();
await guests[0].mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 8 });
await guests[0].mouse.up();
await guests[0].getByText(/^1\/\d+$/).waitFor();
log("Drag-Swipe funktioniert");

const total = await swipeAll(host, [0, 1, 2]);
await swipeAll(guests[0], [2]); // erster Film schon per Drag = Ja
await swipeAll(guests[1], [0, 2]);
log(`Alle haben ${total} Filme bewertet`);

await host.getByText("alle ♥").first().waitFor({ timeout: 8000 });
if (shots) await host.screenshot({ path: `${shots}/5-zwischenstand.png`, fullPage: true });
const finishBtn = host.getByRole("button", { name: /Abstimmung beenden/ });
const label = await finishBtn.textContent();
await finishBtn.click();
await host.getByText("Heute läuft").waitFor();
const winner = await host.locator("h1:visible").textContent();
assert.ok(label.includes(winner), `Gewinner ${winner} passt zum Button ${label}`);
await guests[1].getByText("Heute läuft").waitFor({ timeout: 8000 });
assert.equal(await guests[1].locator("h1:visible").textContent(), winner);
if (shots) await guests[1].screenshot({ path: `${shots}/6-ergebnis.png`, fullPage: true });
log("Gewinner bei allen gleich:", winner);

// Abspann: Gewinner wurde übernommen
await host.goto(`${BASE}/abspann`);
await host.getByText(winner, { exact: false }).waitFor();
log("Gewinner steht im Abspann");
await host.getByPlaceholder("Titel suchen").fill("Testfilm 5");
await host.getByRole("button", { name: /Testfilm 50/ }).click();
await host.getByRole("button", { name: "Testfilm 50 entfernen" }).waitFor();
log("Film manuell zum Abspann hinzugefügt");
if (shots) await host.screenshot({ path: `${shots}/7-abspann.png`, fullPage: true });

// Neue Runde: Abspann-Filme dürfen nicht mehr auftauchen
const res = await host.request.post(`${BASE}/api/rooms`, {
  headers: { Origin: BASE },
  data: { hostName: "Lena", providerIds: [] },
});
assert.equal(res.status(), 201);
const code2 = (await res.json()).code;
await host.request.post(`${BASE}/api/rooms/${code2}/genres`, { headers: { Origin: BASE }, data: { genreIds: [] } });
assert.equal((await host.request.post(`${BASE}/api/rooms/${code2}/start`, { headers: { Origin: BASE }, data: {} })).status(), 200);
const s2 = await (await host.request.get(`${BASE}/api/rooms/${code2}`)).json();
const titles = s2.movies.map((m) => m.title);
assert.ok(!titles.includes(winner) && !titles.includes("Testfilm 50"), "Abspann-Filme ausgeschlossen");
log("Neue Runde schließt Abspann-Filme aus");

// ---- Sicherheitschecks ------------------------------------------------------
const api = guests[0].request;
let r = await api.post(`${BASE}/api/rooms/${code2}/vote`, { headers: { Origin: BASE }, data: { tmdbId: s2.movies[0].tmdbId, liked: true } });
assert.equal(r.status(), 401, "Fremde Runde: kein Abstimmen ohne Beitritt");
r = await api.post(`${BASE}/api/rooms/${code}/start`, { headers: { Origin: BASE }, data: {} });
assert.equal(r.status(), 403, "Gast darf nicht starten");
r = await api.post(`${BASE}/api/rooms`, { headers: { Origin: "https://evil.example" }, data: { hostName: "x" } });
assert.equal(r.status(), 403, "Fremde Origin blockiert");
r = await api.post(`${BASE}/api/rooms`, { headers: { Origin: BASE, "Content-Type": "text/plain" }, data: '{"hostName":"x"}' });
assert.equal(r.status(), 415, "Nur JSON");
r = await api.post(`${BASE}/api/rooms`, { headers: { Origin: BASE }, data: { hostName: "<script>alert(1)</script>" } });
assert.equal(r.status(), 400, "HTML im Namen abgelehnt");
r = await api.get(`${BASE}/api/rooms/AAAAAAAAAA`);
assert.equal(r.status(), 404);
r = await api.get(`${BASE}/api/rooms/${code2}`);
const leak = await r.json();
assert.equal(leak.me, null);
assert.deepEqual(leak.participants, [], "Nicht-Mitglieder sehen keine Teilnehmer");
const cookies = await host.context().cookies();
assert.ok(cookies.filter((c) => c.name.startsWith("fa_")).every((c) => c.httpOnly), "Cookies sind httpOnly");
log("Sicherheitschecks bestanden");

await browser.close();
console.log("\nAlles grün.");
