// Ende-zu-Ende-Test: Fernseher-Link (für Home Assistant) und Fernseh-Ansicht.
// Start: BASE=http://localhost:3100 node tests/e2e/tv.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 };
const tvSize = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };
const log = (...a) => console.log("✓", ...a);
const cspErrors = [];
// Gleiche Seite mit anderem "#" lädt nicht neu, deshalb erst weg und dann hin
const openFresh = async (pg, url) => {
  await pg.goto("about:blank");
  await pg.goto(url);
};
const watch = (pg) => pg.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text()));

// Ohne Crew: Hinweis, erst eine Runde zu starten
const owner = await (await browser.newContext(phone)).newPage();
watch(owner);
await owner.goto(`${BASE}/fernseher`);
await owner.getByRole("heading", { name: "Erst eine Runde starten" }).waitFor();
log("Ohne Crew: Hinweis statt Einrichtung");

// Crew entsteht mit der ersten Runde (normaler Web-Ablauf bleibt unverändert)
await owner.goto(BASE);
await owner.getByPlaceholder("z.B. Lena").fill("Lena");
await owner.getByRole("button", { name: "Netflix", exact: true }).waitFor();
await owner.getByRole("button", { name: "Runde erstellen" }).click();
await owner.waitForURL(/\/r\/[A-Z0-9]{10}$/);
const webCode = owner.url().split("/").pop();
log("Normale Runde im Web erstellt", webCode);

// Normale Runde: Link "Auf dem Fernseher zeigen" öffnet die Großansicht
await owner.getByRole("button", { name: "Action" }).click();
await owner.getByRole("button", { name: /Weiter mit/ }).click();
const tvLink = owner.getByRole("link", { name: "Auf dem Fernseher zeigen" });
assert.equal(await tvLink.getAttribute("href"), `/r/${webCode}/tv`);
const tvWeb = await (await browser.newContext(tvSize)).newPage();
watch(tvWeb);
await tvWeb.goto(`${BASE}/r/${webCode}/tv`);
await tvWeb.getByRole("img", { name: /QR-Code/ }).waitFor();
await tvWeb.getByText("Lena leitet die Runde").waitFor();
await tvWeb.getByText("1 im Saal").waitFor();
log("Fernseh-Ansicht einer normalen Runde");

// Fernseher einrichten: Netflix wählen, Link entsteht
await owner.goto(`${BASE}/fernseher`);
await owner.getByText(/Crew: Crew von Lena/).waitFor();
const netflix = owner.getByRole("button", { name: "Netflix", exact: true });
await netflix.waitFor();
if ((await netflix.getAttribute("aria-pressed")) !== "true") await netflix.click();
await owner.getByRole("button", { name: "Fernseher einrichten" }).click();
const linkBox = owner.getByRole("textbox", { name: "Fernseher-Link" });
await linkBox.waitFor();
const link = await linkBox.inputValue();
assert.match(link, /\/tv#[0-9a-f-]{36}\.1\.[A-Za-z0-9_-]{43}$/);
if (shots) await owner.screenshot({ path: `${shots}/fernseher-einrichten.png`, fullPage: true });
// Nach dem Neuladen ist die gespeicherte Auswahl wieder da
await owner.reload();
await owner.getByRole("button", { name: "Dienste speichern" }).waitFor();
await owner.waitForFunction(() =>
  [...document.querySelectorAll("button[aria-pressed=true]")].some((b) => b.textContent?.includes("Netflix")),
);
log("Fernseher eingerichtet, Dienste gespeichert");

// Fernseher öffnet den Link (das macht später Home Assistant): neue Runde ohne Host
const tv = await (await browser.newContext(tvSize)).newPage();
watch(tv);
await openFresh(tv, link);
await tv.getByRole("img", { name: /QR-Code/ }).waitFor();
await tv.getByText("Wer zuerst beitritt, leitet die Runde.").waitFor();
await tv.getByText("Noch niemand im Saal").waitFor();
const tvCode = (await tv.getByLabel(/Raum-Code/).textContent()).trim();
assert.notEqual(tvCode, webCode);
if (shots) await tv.screenshot({ path: `${shots}/fernseher-lobby-leer.png` });
// Erneut öffnen (z. B. Home Assistant zweimal ausgelöst): dieselbe Runde
await tv.reload();
await tv.getByRole("img", { name: /QR-Code/ }).waitFor();
assert.equal((await tv.getByLabel(/Raum-Code/).textContent()).trim(), tvCode, "laufende Runde wird wiederverwendet");
log("Fernseher-Link öffnet Runde", tvCode, "und nimmt sie beim Neuladen wieder");

// Erste Person wird Host, zweite nicht
const [ben, cem] = [await (await browser.newContext(phone)).newPage(), await (await browser.newContext(phone)).newPage()];
for (const [pg, name] of [[ben, "Ben"], [cem, "Cem"]]) {
  watch(pg);
  await pg.goto(`${BASE}/r/${tvCode}`);
  await pg.getByPlaceholder("Dein Name").fill(name);
  await pg.getByRole("button", { name: "Beitreten" }).click();
  await pg.getByRole("button", { name: "Action" }).click();
  await pg.getByRole("button", { name: /Weiter mit/ }).click();
}
await ben.getByRole("button", { name: "Swipen starten" }).waitFor();
await cem.getByText("Warte, bis der Host startet").waitFor();
const st = await (await ben.request.get(`${BASE}/api/rooms/${tvCode}`)).json();
assert.deepEqual(st.providerIds, [8], "Dienste vom Fernseher gelten");
assert.equal(st.me.isHost, true);
await tv.getByText("2 im Saal").waitFor({ timeout: 8000 });
await tv.getByText("Ben leitet die Runde").waitFor();
if (shots) await tv.screenshot({ path: `${shots}/fernseher-lobby.png` });
log("Erste Person ist Host, Fernseher zeigt alle");

// Swipen: Fernseher zeigt Fortschritt
await ben.getByRole("button", { name: "Swipen starten" }).click();
await ben.getByRole("button", { name: "Überspringen" }).click();
await ben.getByRole("dialog").waitFor({ state: "detached" });
await tv.getByRole("heading", { name: "Es wird geswipt …" }).waitFor({ timeout: 8000 });
await ben.getByRole("button", { name: "Ja", exact: true }).click();
await ben.waitForTimeout(600);
await ben.getByRole("button", { name: "Nein", exact: true }).click();
await tv.getByText(/^2 \/ \d+$/).waitFor({ timeout: 8000 });
if (shots) await tv.screenshot({ path: `${shots}/fernseher-swipen.png` });
log("Fernseher zeigt Fortschritt");

// Host beendet: Fernseher zeigt den Gewinner
await ben.getByRole("button", { name: /Abstimmung beenden/ }).click();
await tv.getByText("Heute läuft").waitFor({ timeout: 8000 });
const winner = (await (await ben.request.get(`${BASE}/api/rooms/${tvCode}/tv`)).json()).winner;
assert.ok(winner?.title, "Gewinner steht fest");
await tv.getByRole("heading", { name: winner.title }).waitFor();
await tv.waitForTimeout(3500); // Konfetti abwarten
if (shots) await tv.screenshot({ path: `${shots}/fernseher-gewinner.png` });
log("Fernseher zeigt Gewinner:", winner.title);

// Nach dem Ende: Link öffnet eine neue Runde, ebenso der Knopf
await tv.reload();
await tv.getByText("Noch niemand im Saal").waitFor();
const second = (await tv.getByLabel(/Raum-Code/).textContent()).trim();
assert.notEqual(second, tvCode, "nach dem Ende gibt es eine neue Runde");
log("Nach dem Ende startet der Link eine neue Runde");

// Neuer Link: alter geht nicht mehr
await owner.getByRole("button", { name: /Neuen Link erzeugen/ }).click();
await owner.waitForFunction((old) => document.querySelector('input[aria-label="Fernseher-Link"]')?.value !== old, link);
const link2 = await linkBox.inputValue();
assert.match(link2, /\.2\./);
await openFresh(tv, link);
await tv.getByText(/gilt nicht mehr/).waitFor();
await openFresh(tv, link2);
await tv.getByRole("img", { name: /QR-Code/ }).waitFor();
log("Neuer Link ersetzt den alten");

// Gefälschter Link und fremde Origin werden abgelehnt
const forged = link2.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
await openFresh(tv, forged);
await tv.getByText(/gilt nicht mehr/).waitFor();
const token = link2.split("#")[1];
const evil = await tv.request.post(`${BASE}/api/tv`, { headers: { Origin: "https://boese.example" }, data: { token } });
assert.equal(evil.status(), 403);
log("Gefälschter Link und fremde Origin abgelehnt");

// Ausschalten
await owner.getByRole("button", { name: "Fernseher-Link ausschalten" }).click();
await owner.getByRole("button", { name: "Fernseher einrichten" }).waitFor();
await openFresh(tv, link2);
await tv.getByText(/gilt nicht mehr/).waitFor();
log("Ausgeschalteter Link geht nicht mehr");

// Ohne Link
await tv.goto(`${BASE}/tv`);
await tv.getByRole("heading", { name: "Hier fehlt der Fernseher-Link" }).waitFor();

assert.deepEqual(cspErrors, [], "CSP-Verstöße");
log("Keine CSP-Verstöße");
await browser.close();
