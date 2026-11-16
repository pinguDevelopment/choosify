// Ende-zu-Ende-Test: „Train my Algorithm“ (allein Filme bewerten) und Wirkung in einer Gruppenrunde.
// Braucht AUTH_MOCK=1 und TMDB_MOCK=1 auf dem Server (Code ist dann immer 123456).
// Start: BASE=http://localhost:3100 node tests/e2e/training.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const shots = process.env.SHOTS;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "de-DE" };
const log = (...a) => console.log("✓", ...a);
const newDevice = async () => (await browser.newContext(phone)).newPage();
const email = `train.${Date.now()}@example.org`;
const COMEDY = 35;
const HORROR = 27;
const json = (page, path, method = "GET", body) =>
  page.request
    .fetch(`${BASE}${path}`, {
      method,
      headers: { origin: BASE, "accept-language": "de-DE", ...(body ? { "content-type": "application/json" } : {}) },
      data: body ? JSON.stringify(body) : undefined,
    })
    .then(async (r) => ({ status: r.status(), body: await r.json().catch(() => ({})) }));

// ---- Ohne Konto: Hinweis zum Anmelden ----
const guest = await newDevice();
await guest.goto(`${BASE}/trainieren`);
await guest.getByRole("heading", { name: "Erst anmelden" }).waitFor();
assert.equal((await json(guest, "/api/training/vote", "POST", { tmdbId: 1000, choice: "yes" })).status, 401);
log("Ohne Konto: Anmelde-Hinweis, Stimmen abgelehnt");

// ---- Anmelden ----
const a = await newDevice();
await a.goto(`${BASE}/konto`);
await a.getByLabel("E-Mail-Adresse").fill(email);
await a.getByRole("button", { name: "Anmelde-Link schicken" }).click();
await a.getByLabel("Code aus der Mail").fill("123456");
await a.getByRole("button", { name: "Anmelden", exact: true }).click();
await a.getByText("Angemeldet als").waitFor();
await a.getByRole("link", { name: "Trainieren" }).click();
await a.waitForURL(/\/trainieren$/);
await a.getByText("0 Filme trainiert").waitFor();
await a.getByRole("button", { name: "Mag ich" }).waitFor();
if (shots) await a.screenshot({ path: `${shots}/train-1-start.png` });
log("Trainings-Seite mit Stapel");

// ---- Swipen mit Knöpfen und Tastatur, Rückgängig, Überspringen ----
// Oberste Karte = letzte im DOM; erst warten, bis die rausfliegende Karte weg ist
const topTitle = async () => {
  await a.waitForTimeout(700);
  return a.locator("article h3").last().textContent();
};
const first = await topTitle();
await a.getByRole("button", { name: "Mag ich" }).click();
await a.getByText("1 Film trainiert").waitFor();
await a.getByRole("button", { name: "Nicht meins" }).click();
await a.getByText("2 Filme trainiert").waitFor();
await a.getByRole("button", { name: "Rückgängig" }).click();
await a.getByText("1 Film trainiert").waitFor();
const second = await topTitle();
assert.notEqual(first, second);
await a.getByRole("button", { name: "Überspringen, kenn ich nicht" }).click();
assert.notEqual(await topTitle(), second, "übersprungen");
await a.getByText("1 Film trainiert").waitFor(); // Überspringen zählt nicht
await a.keyboard.press("ArrowUp");
await a.getByText("2 Filme trainiert").waitFor();
await a.keyboard.press("ArrowRight");
await a.getByText("3 Filme trainiert").waitFor();
log("Knöpfe, Tastatur, Rückgängig und Überspringen");

// ---- Gezielt trainieren: Komödien mag ich, Horror nicht ----
let trained = 0;
for (let round = 0; round < 3 && trained < 24; round++) {
  const { body } = await json(a, "/api/training/movies", "POST", { exclude: [] });
  for (const m of body.movies) {
    const choice = m.genreIds.includes(COMEDY) && !m.genreIds.includes(HORROR) ? "yes" : m.genreIds.includes(HORROR) ? "no" : null;
    if (!choice) continue;
    assert.equal((await json(a, "/api/training/vote", "POST", { tmdbId: m.tmdbId, choice })).status, 200);
    trained++;
  }
}
assert.ok(trained >= 8, `trainiert: ${trained}`);
const profile = (await json(a, "/api/training")).body;
assert.ok(profile.count >= trained, "Anzahl");
assert.ok(profile.taste.likes.includes("Komödie"), `likes: ${profile.taste.likes}`);
assert.ok(profile.taste.dislikes.includes("Horror"), `dislikes: ${profile.taste.dislikes}`);
assert.ok(profile.useInGroups, "Standard: in Gruppen an");
// Schon trainierte Filme kommen nicht nochmal
const voted = new Set(profile.recent.map((r) => r.tmdbId));
const next = (await json(a, "/api/training/movies", "POST", { exclude: [] })).body.movies;
assert.ok(next.every((m) => !voted.has(m.tmdbId)), "keine Doppelten");
log(`Geschmack gelernt aus ${profile.count} Filmen: mag ${profile.taste.likes.join(", ")}`);

await a.reload();
await a.getByText("Was Cinemood über dich weiß").waitFor();
await a.getByText("Komödie").first().waitFor();
if (shots) await a.screenshot({ path: `${shots}/train-2-profil.png`, fullPage: true });

// Schalter aus und wieder an
const sw = a.getByRole("switch", { name: /In Gruppenrunden nutzen/ });
assert.equal(await sw.getAttribute("aria-checked"), "true");
await sw.click();
await a.waitForTimeout(400);
assert.equal((await json(a, "/api/training")).body.useInGroups, false);
await sw.click();
await a.waitForTimeout(400);
assert.equal((await json(a, "/api/training")).body.useInGroups, true);
log("Schalter „In Gruppenrunden nutzen“");

// ---- Gruppenrunde: angemeldete Person bekommt ihren Stapel nach Geschmack ----
await a.goto(BASE);
await a.getByRole("button", { name: "Netflix", exact: true }).waitFor();
await a.getByPlaceholder("z.B. Lena").fill("Tina");
await a.getByRole("button", { name: "Runde erstellen" }).click();
await a.waitForURL(/\/r\/[A-Z0-9]{10}$/);
const url = a.url();
const code = url.split("/").pop();
await a.getByRole("button", { name: "Komödie" }).click();
await a.getByRole("button", { name: "Horror" }).click();
await a.getByRole("button", { name: /Weiter mit 2 Genres/ }).click();
const b = await newDevice();
await b.goto(url);
await b.getByPlaceholder("Dein Name").fill("Ben");
await b.getByRole("button", { name: "Beitreten" }).click();
await b.getByRole("button", { name: "Komödie" }).click();
await b.getByRole("button", { name: "Horror" }).click();
await b.getByRole("button", { name: /Weiter mit/ }).click();
await a.getByText("2 bereit").waitFor({ timeout: 8000 });
await a.getByRole("button", { name: "Swipen starten" }).click();
await a.getByRole("button", { name: "Ja" }).waitFor();

const deck = async (page) => (await json(page, `/api/rooms/${code}`)).body.movies;
const avgPos = (movies, genre) => {
  const pos = movies.flatMap((m, i) => (m.genreIds.includes(genre) && !m.genreIds.includes(genre === COMEDY ? HORROR : COMEDY) ? [i] : []));
  return pos.reduce((s, p) => s + p, 0) / Math.max(1, pos.length);
};
const mine = await deck(a);
const other = await deck(b);
assert.ok(mine.length > 5 && mine.length === other.length);
assert.ok(avgPos(mine, COMEDY) < avgPos(mine, HORROR), `Tina: Komödien ${avgPos(mine, COMEDY)} vor Horror ${avgPos(mine, HORROR)}`);
assert.deepEqual(new Set(mine.map((m) => m.tmdbId)), new Set(other.map((m) => m.tmdbId)), "alle swipen dieselben Filme");
log(`Gruppenrunde: Komödien bei Tina im Schnitt auf Platz ${avgPos(mine, COMEDY).toFixed(1)}, Horror auf ${avgPos(mine, HORROR).toFixed(1)}`);

// ---- Vergessen und Zurücksetzen ----
await a.goto(`${BASE}/trainieren`);
const before = (await json(a, "/api/training")).body.count;
await a.getByRole("button", { name: /vergessen$/ }).first().click();
await a.getByText(`${before - 1} Filme trainiert`).waitFor();
await a.getByRole("button", { name: "Training zurücksetzen" }).click();
await a.getByRole("button", { name: "Ja, alles löschen" }).click();
await a.getByText("0 Filme trainiert").waitFor();
assert.equal((await json(a, "/api/training")).body.count, 0);
log("Einzelnen Film vergessen und Training zurückgesetzt");

// ---- Englisch ----
await a.getByRole("button", { name: "English" }).click();
await a.getByText("0 movies trained").waitFor();
await a.getByRole("button", { name: "Like it" }).waitFor();
log("Englische Oberfläche");

await browser.close();
console.log("Alles grün.");
