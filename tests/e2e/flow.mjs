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
// CSP-Verstöße sammeln: jede blockierte Ressource lässt den Test scheitern.
const cspErrors = [];
for (const pg of [host, ...guests]) {
  pg.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text()));
}

// Host erstellt Runde mit Netflix
await host.goto(BASE);
await host.getByPlaceholder("z.B. Lena").fill("Lena");
// Erst nur bekannte Dienste, Varianten und Channels unter "Mehr anzeigen"
await host.getByRole("button", { name: "Netflix", exact: true }).waitFor();
assert.equal(await host.getByRole("button", { name: "MUBI Amazon Channel" }).count(), 0, "Nischendienste erst auf Klick");
await host.getByRole("button", { name: /Mehr anzeigen/ }).click();
await host.getByRole("button", { name: "MUBI Amazon Channel" }).waitFor();
await host.getByRole("button", { name: "Weniger anzeigen" }).click();
await host.getByRole("button", { name: "Netflix", exact: true }).click();
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

// Alle stimmen ab. Jede Person hat eine eigene Reihenfolge, deshalb wird pro Film entschieden:
// plan = { tmdbId: "Ja" | "Wäre ok" }, alles andere "Nein".
const roomState = async (page) => (await page.request.get(`${BASE}/api/rooms/${code}`)).json();
async function swipeAll(page, plan) {
  const st = await roomState(page);
  const open = st.movies.filter((m) => st.myVotes[m.tmdbId] == null);
  for (const m of open) {
    await page.getByRole("button", { name: plan[m.tmdbId] ?? "Nein", exact: true }).click({ timeout: 5000 }).catch(async (e) => { await page.screenshot({ path: "/var/tmp/fa-fail.png" }); console.log("fail at", m.title); throw e; });
  }
  await page.getByText("Du bist durch!").waitFor();
  return st.movies.length;
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
await guests[0].getByRole("button", { name: "Rückgängig" }).click();
await guests[0].getByText(/^0\/\d+$/).waitFor();
log("Rückgängig funktioniert");
await guests[0].keyboard.press("ArrowRight");
await guests[0].getByText(/^1\/\d+$/).waitFor();
log("Tastatur-Swipe funktioniert");
// Wisch nach oben = Wäre ok
await guests[0].waitForTimeout(700); // Rausflug-Animation der vorigen Karte abwarten
const card2 = guests[0].locator("article").last();
const box2 = await card2.boundingBox();
await guests[0].mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
await guests[0].mouse.down();
await guests[0].mouse.move(box2.x + box2.width / 2 + 10, box2.y + box2.height / 2 - 220, { steps: 8 });
await guests[0].mouse.up();
await guests[0].getByText(/^2\/\d+$/).waitFor();
const g0 = await roomState(guests[0]);
assert.equal(g0.myVotes[g0.movies[1].tmdbId], "maybe", "Wisch nach oben speichert Wäre ok");
await guests[0].keyboard.press("Backspace");
await guests[0].getByText(/^1\/\d+$/).waitFor();
log("Wisch nach oben = Wäre ok funktioniert");

// Reihenfolge ist pro Person gemischt
const hostState = await roomState(host);
assert.notDeepEqual(hostState.movies.map((m) => m.tmdbId), g0.movies.map((m) => m.tmdbId), "eigene Reihenfolge pro Person");
assert.deepEqual((await roomState(host)).movies.map((m) => m.tmdbId), hostState.movies.map((m) => m.tmdbId), "Reihenfolge bleibt stabil");
log("Jede Person hat eine eigene, stabile Reihenfolge");

// a und c wollen alle (alle ♥, also Gleichstand -> Stichwahl), b ist für alle ok (alle dabei).
// Lenas erster Film (per Tastatur schon Ja) bleibt außen vor, damit der Gleichstand sicher genau a und c betrifft.
const [a, b, c] = hostState.movies.map((m) => m.tmdbId).filter((id) => id !== g0.movies[0].tmdbId).sort((x, y) => x - y);
const total = await swipeAll(host, { [a]: "Ja", [b]: "Ja", [c]: "Ja" });
await swipeAll(guests[0], { [a]: "Ja", [b]: "Wäre ok", [c]: "Ja" });
await swipeAll(guests[1], { [a]: "Ja", [b]: "Wäre ok", [c]: "Ja" });
log(`Alle haben ${total} Filme bewertet`);

await host.getByText("alle ♥").first().waitFor({ timeout: 8000 });
await host.getByText("alle dabei").first().waitFor();
const rank = (await roomState(host)).ranking;
assert.deepEqual(rank.filter((r) => r.unanimous).map((r) => r.tmdbId).sort((x, y) => x - y), [a, c]);
assert.ok(rank.find((r) => r.tmdbId === b).acceptable, "Ja + Wäre ok ohne Nein = alle dabei");
log("Rangliste: alle ♥ vor alle dabei");
if (shots) await host.screenshot({ path: `${shots}/5-zwischenstand.png`, fullPage: true });

// Gleichstand -> Stichwahl -> genau ein Gewinner
const finishBtn = host.getByRole("button", { name: /Abstimmung beenden/ });
assert.match(await finishBtn.textContent(), /Stichwahl \(2 Filme\)/);
await finishBtn.click();
await host.getByRole("heading", { name: "Stichwahl" }).waitFor();
await guests[1].getByRole("heading", { name: "Stichwahl" }).waitFor({ timeout: 8000 });
const titleOf = (id) => hostState.movies.find((m) => m.tmdbId === id).title;
let bad = await guests[0].request.post(`${BASE}/api/rooms/${code}/runoff`, { headers: { Origin: BASE }, data: { tmdbId: b } });
assert.equal(bad.status(), 400, "Nur Filme aus der Stichwahl wählbar");
await host.getByRole("button", { name: `${titleOf(c)} wählen` }).click();
await host.getByText("1 von 3 haben gewählt").waitFor();
await guests[0].getByRole("button", { name: `${titleOf(a)} wählen` }).click(); // erst a ...
await guests[0].getByRole("button", { name: `${titleOf(c)} wählen` }).click(); // ... dann umentschieden
await host.getByText("2 von 3 haben gewählt").waitFor({ timeout: 8000 });
if (shots) await host.screenshot({ path: `${shots}/5b-stichwahl.png`, fullPage: true });
await guests[1].getByRole("button", { name: `${titleOf(a)} wählen` }).click(); // letzte Stimme beendet automatisch
await host.getByText("Heute läuft").waitFor({ timeout: 8000 });
const winner = await host.locator("h1:visible").textContent();
assert.equal(winner, titleOf(c), "Stichwahl 2:1 für c");
await host.getByText("In der Stichwahl gewonnen: 2 von 3 Stimmen.").waitFor();
await guests[1].getByText("Heute läuft").waitFor({ timeout: 8000 });
assert.equal(await guests[1].locator("h1:visible").textContent(), winner);
if (shots) await guests[1].screenshot({ path: `${shots}/6-ergebnis.png`, fullPage: true });
log("Stichwahl entscheidet, Gewinner bei allen gleich:", winner);

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
// Im Mock ist jeder 4. Film nur zum Leihen (z. B. noch im Kino): der darf nie vorkommen
assert.ok(s2.movies.length > 0 && s2.movies.every((m) => m.tmdbId % 4 !== 3), "nur Filme, die im Abo laufen");
assert.ok(hostState.movies.every((m) => m.tmdbId % 4 !== 3), "auch in der ersten Runde nur Streambares");
log("Nur Filme, die gerade im Abo laufen");
// "Sonstige / eigene Quelle": dann dürfen auch Filme kommen, die nirgends im Abo laufen
const res3 = await host.request.post(`${BASE}/api/rooms`, { headers: { Origin: BASE }, data: { hostName: "Lena", providerIds: [8], anySource: true } });
const code3 = (await res3.json()).code;
await host.request.post(`${BASE}/api/rooms/${code3}/genres`, { headers: { Origin: BASE }, data: { genreIds: [] } });
assert.equal((await host.request.post(`${BASE}/api/rooms/${code3}/start`, { headers: { Origin: BASE }, data: {} })).status(), 200);
const s3 = await (await host.request.get(`${BASE}/api/rooms/${code3}`)).json();
assert.ok(s3.movies.some((m) => m.tmdbId % 4 === 3), "mit eigener Quelle auch Leih-/Kauffilme");
log("Sonstige / eigene Quelle schlägt alle Filme vor");

// ---- Sicherheitschecks ------------------------------------------------------
const api = guests[0].request;
let r = await api.post(`${BASE}/api/rooms/${code2}/vote`, { headers: { Origin: BASE }, data: { tmdbId: s2.movies[0].tmdbId, choice: "yes" } });
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

assert.deepEqual(cspErrors, [], "Keine CSP-Verstöße");
log("Keine CSP-Verstöße");

// Rate Limit beim Beitreten (gegen Code-Raten)
let limitedHit = false;
for (let i = 0; i < 60; i++) {
  const rr = await api.post(`${BASE}/api/rooms/AAAAAAAAAA/join`, { headers: { Origin: BASE }, data: { name: `x${i}` } });
  if (rr.status() === 429) { limitedHit = true; break; }
}
assert.ok(limitedHit, "Beitreten wird nach vielen Versuchen gebremst");
log("Rate Limit greift");

await browser.close();
console.log("\nAlles grün.");
