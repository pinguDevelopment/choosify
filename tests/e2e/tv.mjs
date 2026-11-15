// Ende-zu-Ende-Test: Fernseher per Code koppeln und Fernseh-Ansicht.
// Start: BASE=http://localhost:3100 node tests/e2e/tv.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "de-DE" };
const tvSize = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "de-DE" };
const log = (...a) => console.log("✓", ...a);
const cspErrors = [];
const watch = (pg) => pg.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text()));
const pairCode = async (pg) => (await pg.getByLabel(/^Kopplungscode/).first().getAttribute("aria-label")).split(" ").pop();

// Anleitung auf der Seite "Fernseher"
const lena = await (await browser.newContext(phone)).newPage();
watch(lena);
await lena.goto(`${BASE}/fernseher`);
await lena.getByText(/\/tv aufrufen/).waitFor();
if (shots) await lena.screenshot({ path: `${shots}/fernseher-anleitung.png`, fullPage: true });
log("Seite Fernseher erklärt das Koppeln");

// Fernseher öffnet /tv und zeigt einen Code
const tvCtx = await browser.newContext(tvSize);
const tv = await tvCtx.newPage();
watch(tv);
await tv.goto(`${BASE}/tv`);
await tv.getByRole("heading", { name: "Fernseher verbinden" }).waitFor();
const code1 = await pairCode(tv);
assert.match(code1, /^[2-9A-HJKMNP-Z]{6}$/);
if (shots) await tv.screenshot({ path: `${shots}/fernseher-code.png` });
// Neu laden: derselbe Code (Geheimnis im localStorage)
await tv.reload();
await tv.getByRole("heading", { name: "Fernseher verbinden" }).waitFor();
assert.equal(await pairCode(tv), code1, "Code bleibt beim Neuladen");
log("Fernseher zeigt Code", code1);

// Host startet Runde und koppelt (schon beim Genre-Wählen möglich)
await lena.goto(BASE);
await lena.getByPlaceholder("z.B. Lena").fill("Lena");
await lena.getByRole("button", { name: "Netflix", exact: true }).waitFor();
await lena.getByRole("button", { name: "Runde erstellen" }).click();
await lena.waitForURL(/\/r\/[A-Z0-9]{10}$/);
const roomCode = lena.url().split("/").pop();
await lena.getByRole("button", { name: "Auf dem Fernseher zeigen" }).click();
const input = lena.getByRole("textbox", { name: "Code vom Fernseher" });
// Falsche Form: Hinweis ohne Anfrage
await input.fill("abc");
await lena.getByRole("button", { name: "Verbinden" }).click();
await lena.getByText("Der Code hat 6 Zeichen").waitFor();
// Unbekannter Code
await input.fill(code1 === "222222" ? "333333" : "222222");
await lena.getByRole("button", { name: "Verbinden" }).click();
await lena.getByText(/Diesen Code gibt es nicht/).waitFor();
if (shots) await lena.screenshot({ path: `${shots}/fernseher-eingabe.png` });
// Richtiger Code, klein und mit Leerzeichen geschrieben
await input.fill(`${code1.slice(0, 3).toLowerCase()} ${code1.slice(3).toLowerCase()}`);
await lena.getByRole("button", { name: "Verbinden" }).click();
await lena.getByRole("button", { name: "Fernseher verbunden ✓" }).waitFor();
log("Host koppelt mit Code");

// Fernseher schaltet von selbst auf den QR-Code der Runde
await tv.getByRole("img", { name: /QR-Code zum Beitreten/ }).waitFor({ timeout: 8000 });
assert.equal((await tv.getByLabel(/Raum-Code/).textContent()).trim(), roomCode);
await tv.getByText("Lena leitet die Runde").waitFor();
log("Fernseher zeigt automatisch die Runde");

// Derselbe Code geht kein zweites Mal
const again = await lena.request.post(`${BASE}/api/rooms/${roomCode}/tv`, { headers: { Origin: BASE }, data: { code: code1 } });
assert.equal(again.status(), 404, "Code nur einmal nutzbar");
// Gäste dürfen nicht koppeln, fremde Origin wird abgelehnt
const ben = await (await browser.newContext(phone)).newPage();
watch(ben);
await ben.goto(`${BASE}/r/${roomCode}`);
await ben.getByPlaceholder("Dein Name").fill("Ben");
await ben.getByRole("button", { name: "Beitreten" }).click();
await ben.getByRole("button", { name: "Action" }).click();
await ben.getByRole("button", { name: /Weiter mit/ }).click();
await ben.getByText("Warte, bis der Host startet").waitFor();
assert.equal(await ben.getByRole("button", { name: "Auf dem Fernseher zeigen" }).count(), 0, "Gäste sehen das Koppeln nicht");
const guest = await ben.request.post(`${BASE}/api/rooms/${roomCode}/tv`, { headers: { Origin: BASE }, data: { code: "222222" } });
assert.equal(guest.status(), 403);
const evil = await tv.request.post(`${BASE}/api/tv`, { headers: { Origin: "https://boese.example" }, data: {} });
assert.equal(evil.status(), 403);
log("Code nur einmal, nur Host, fremde Origin abgelehnt");

// Neu laden: Fernseher zeigt weiter dieselbe Runde
await tv.reload();
await tv.getByRole("img", { name: /QR-Code zum Beitreten/ }).waitFor();
assert.equal((await tv.getByLabel(/Raum-Code/).textContent()).trim(), roomCode);
await tv.getByText("2 im Saal").waitFor({ timeout: 8000 });
if (shots) await tv.screenshot({ path: `${shots}/fernseher-lobby.png` });
log("Nach dem Neuladen dieselbe Runde");

// Swipen: Fernseher zeigt Fortschritt
await lena.getByRole("button", { name: "Action" }).click();
await lena.getByRole("button", { name: /Weiter mit/ }).click();
await lena.getByRole("button", { name: "Swipen starten" }).click();
await lena.getByRole("button", { name: "Überspringen" }).click();
await lena.getByRole("dialog").waitFor({ state: "detached" });
await tv.getByRole("heading", { name: "Es wird geswipt …" }).waitFor({ timeout: 8000 });
await lena.getByRole("button", { name: "Ja", exact: true }).click();
await tv.getByText(/^1 \/ \d+$/).waitFor({ timeout: 8000 });
log("Fernseher zeigt Fortschritt");

// Host beendet: Gewinner, darunter der Code für die nächste Runde
await lena.getByRole("button", { name: /Abstimmung beenden/ }).click();
await tv.getByText("Heute läuft").waitFor({ timeout: 8000 });
await tv.getByText(/Nächste Runde\?/).waitFor({ timeout: 8000 });
const code2 = await pairCode(tv);
assert.notEqual(code2, code1);
await tv.waitForTimeout(3500); // Konfetti abwarten
if (shots) await tv.screenshot({ path: `${shots}/fernseher-gewinner.png` });
log("Gewinner mit neuem Code", code2);

// Nächste Runde mit dem neuen Code koppeln
await lena.goto(BASE);
await lena.getByPlaceholder("z.B. Lena").fill("Lena");
await lena.getByRole("button", { name: "Netflix", exact: true }).waitFor();
await lena.getByRole("button", { name: "Runde erstellen" }).click();
await lena.waitForURL((u) => /\/r\/[A-Z0-9]{10}$/.test(u.pathname) && !u.pathname.endsWith(roomCode));
const room2 = lena.url().split("/").pop();
await lena.getByRole("button", { name: "Auf dem Fernseher zeigen" }).click();
await lena.getByRole("textbox", { name: "Code vom Fernseher" }).fill(code2);
await lena.getByRole("button", { name: "Verbinden" }).click();
await tv.getByText("Noch niemand im Saal").or(tv.getByText("1 im Saal")).waitFor({ timeout: 8000 });
assert.equal((await tv.getByLabel(/Raum-Code/).textContent()).trim(), room2);
log("Nächste Runde auf demselben Fernseher");

// Großansicht ohne Code (z. B. Laptop) geht weiter
const direct = await (await browser.newContext(tvSize)).newPage();
watch(direct);
await direct.goto(`${BASE}/r/${room2}/tv`);
await direct.getByRole("img", { name: /QR-Code zum Beitreten/ }).waitFor();
log("Direkte Großansicht");

// Englisch
const en = await (await browser.newContext({ ...tvSize, locale: "en-US" })).newPage();
await en.goto(`${BASE}/tv`);
await en.getByRole("heading", { name: "Connect this TV" }).waitFor();
log("Fernseher-Seite auf Englisch");

assert.deepEqual(cspErrors, [], "CSP-Verstöße");
log("Keine CSP-Verstöße");
await browser.close();
