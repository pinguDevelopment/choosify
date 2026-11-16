import { test } from "node:test";
import assert from "node:assert/strict";
import { averageStars, crewTaste, groupBooster, personalTaste, tasteBoost, tasteRerank, tasteSummary, EMPTY_TASTE } from "../src/lib/taste.ts";
import { pickCandidates } from "../src/lib/candidates.ts";

const HORROR = 27;
const COMEDY = 35;
const SCIFI = 878;

test("averageStars: rundet auf eine Stelle, leer = null", () => {
  assert.equal(averageStars([5, 4, 4]), 4.3);
  assert.equal(averageStars([]), null);
});

test("crewTaste: 5 Sterne heben Genre und Tags, 1 Stern senkt sie", () => {
  const t = crewTaste([
    { genreIds: [COMEDY], tags: ["lustig", "zeitreise"], stars: [5, 5] },
    { genreIds: [HORROR], tags: ["gruselig", "slasher"], stars: [1, 2] },
    { genreIds: [SCIFI], tags: [], stars: [] }, // unbewertet: zählt nicht
  ]);
  assert.equal(t.rated, 2);
  assert.ok(t.genres.get(COMEDY)! > 0.4);
  assert.ok(t.genres.get(HORROR)! < -0.3);
  assert.equal(t.genres.has(SCIFI), false);
  assert.ok(t.tags.get("zeitreise")! > 0);
  // Stimmungs-Tags (#lustig) doppeln das Genre und zählen nicht extra
  assert.equal(t.tags.has("lustig"), false);
});

test("crewTaste: ein einzelner Film kippt den Geschmack nicht ganz (Dämpfung)", () => {
  const one = crewTaste([{ genreIds: [COMEDY], tags: [], stars: [5] }]);
  const three = crewTaste([1, 2, 3].map(() => ({ genreIds: [COMEDY], tags: [], stars: [5] })));
  assert.equal(one.genres.get(COMEDY), 0.5);
  assert.ok(three.genres.get(COMEDY)! > one.genres.get(COMEDY)!);
  assert.ok(three.genres.get(COMEDY)! < 1);
});

test("tasteBoost: ohne Bewertungen 0, sonst zwischen -1 und 1", () => {
  assert.equal(tasteBoost(EMPTY_TASTE, [COMEDY], ["zeitreise"]), 0);
  const t = crewTaste([
    { genreIds: [COMEDY], tags: ["zeitreise"], stars: [5] },
    { genreIds: [HORROR], tags: ["slasher"], stars: [1] },
  ]);
  assert.ok(tasteBoost(t, [COMEDY], ["zeitreise"]) > 0);
  assert.ok(tasteBoost(t, [HORROR], ["slasher"]) < 0);
  assert.equal(tasteBoost(t, [SCIFI], ["weltraum"]), 0, "Unbekanntes ist neutral");
  // nur Genres (vor dem Detail-Abruf)
  assert.equal(tasteBoost(t, [COMEDY]), t.genres.get(COMEDY));
});

test("tasteRerank: verschiebt höchstens um `shift` Plätze, sonst bleibt die Reihenfolge", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const out = tasteRerank(items, (i) => (i === 15 ? 1 : 0), 8);
  assert.equal(out.indexOf(15), 8); // Gleichstand mit Platz 7: der ursprünglich frühere bleibt vorne
  assert.deepEqual(tasteRerank(items, () => 0), items);
  const down = tasteRerank(items, (i) => (i === 0 ? -1 : 0), 8);
  assert.equal(down.indexOf(0), 7);
});

test("tasteSummary: zeigt deutliche Vorlieben mit deutschen Namen", () => {
  const t = crewTaste([
    { genreIds: [COMEDY], tags: ["zeitreise"], stars: [5, 5] },
    { genreIds: [COMEDY], tags: ["zeitreise"], stars: [5] },
    { genreIds: [HORROR], tags: [], stars: [1] },
  ]);
  const s = tasteSummary(t);
  assert.deepEqual(s.likes.slice(0, 2).sort(), ["#zeitreise", "Komödie"]);
  assert.deepEqual(s.dislikes, ["Horror"]);
});

test("pickCandidates: Geschmack der Crew bevorzugt passende Filme", () => {
  const movies = [
    { id: 1, title: "Grusel", genre_ids: [HORROR], vote_average: 8 },
    { id: 2, title: "Spaß", genre_ids: [COMEDY], vote_average: 6 },
  ];
  const sel = [[HORROR, COMEDY], [HORROR, COMEDY]];
  assert.equal(pickCandidates(movies, sel, [], 1)[0].id, 1, "ohne Geschmack: bessere TMDB-Bewertung");
  const t = crewTaste([{ genreIds: [COMEDY], tags: [], stars: [5] }]);
  assert.equal(pickCandidates(movies, sel, [], 1, (m) => tasteBoost(t, m.genre_ids))[0].id, 2);
});

// ---- „Train my Algorithm“ ----

test("personalTaste: Mag ich hebt, Nicht meins senkt, Geht so zieht Richtung neutral", () => {
  const t = personalTaste([
    { tmdbId: 1, choice: 1, genreIds: [COMEDY], tags: ["zeitreise"] },
    { tmdbId: 2, choice: 1, genreIds: [COMEDY], tags: [] },
    { tmdbId: 3, choice: -1, genreIds: [HORROR], tags: ["slasher"] },
    { tmdbId: 4, choice: 0, genreIds: [SCIFI], tags: [] },
  ]);
  assert.equal(t.rated, 4);
  assert.ok(t.genres.get(COMEDY)! > 0.6);
  assert.ok(t.genres.get(HORROR)! < -0.4);
  assert.equal(t.genres.get(SCIFI), 0);
  assert.ok(t.tags.get("zeitreise")! > 0);
  assert.equal(t.films?.get(3), -1);
});

test("tasteBoost: eigene Meinung zu genau diesem Film zählt stärker als das Genre", () => {
  const t = personalTaste([
    ...[10, 11, 12, 13].map((id) => ({ tmdbId: id, choice: 1, genreIds: [HORROR], tags: [] })),
    { tmdbId: 14, choice: -1, genreIds: [HORROR], tags: [] },
  ]);
  assert.ok(tasteBoost(t, [HORROR]) > 0.3, "Horror allgemein gemocht");
  assert.ok(tasteBoost(t, [HORROR], [], 14) < 0, "diesen einen Horrorfilm aber nicht");
  assert.ok(tasteBoost(t, [HORROR], [], 10) > tasteBoost(t, [HORROR]), "gemochter Film noch weiter vorne");
});

test("groupBooster: ohne Daten null, Trainierte werden gemittelt, Crew zählt zur Hälfte", () => {
  assert.equal(groupBooster(EMPTY_TASTE, [EMPTY_TASTE]), null);
  const fan = personalTaste([{ tmdbId: 1, choice: 1, genreIds: [HORROR], tags: [] }]);
  const hater = personalTaste([{ tmdbId: 2, choice: -1, genreIds: [HORROR], tags: [] }]);
  const both = groupBooster(EMPTY_TASTE, [fan, hater, EMPTY_TASTE])!;
  assert.equal(both([HORROR]), 0, "Fan und Gegner heben sich auf, Untrainierte zählen nicht");
  const onlyFan = groupBooster(EMPTY_TASTE, [fan])!;
  assert.ok(onlyFan([HORROR]) > 0);
  const crew = crewTaste([{ genreIds: [HORROR], tags: [], stars: [1] }]);
  const mixed = groupBooster(crew, [fan])!;
  assert.ok(Math.abs(mixed([HORROR])) < onlyFan([HORROR]), "Crew mag Horror nicht, das bremst");
});
