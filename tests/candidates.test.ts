import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverParams, franchiseKey, genreDemand, personalOrder, pickCandidates, releaseYear } from "../src/lib/candidates.ts";

test("discoverParams verknüpft Anbieter und Genres mit ODER", () => {
  const p = discoverParams({ region: "DE", providerIds: [8, 9], genreIds: [28, 35], page: 2 });
  assert.equal(p.get("with_watch_providers"), "8|9");
  assert.equal(p.get("with_genres"), "28|35");
  assert.equal(p.get("watch_region"), "DE");
  assert.equal(p.get("include_adult"), "false");
  assert.equal(p.get("page"), "2");
});

test("ohne Anbieter keine Anbieter-Filter", () => {
  const p = discoverParams({ region: "DE", providerIds: [], genreIds: [], page: 1 });
  assert.equal(p.has("with_watch_providers"), false);
  assert.equal(p.has("with_genres"), false);
});

test("genreDemand zählt jede Person pro Genre nur einmal", () => {
  const d = genreDemand([[28, 28, 35], [28]]);
  assert.equal(d.get(28), 2);
  assert.equal(d.get(35), 1);
});

test("pickCandidates entfernt Abspann-Filme und Duplikate und sortiert nach Nachfrage", () => {
  const movies = [
    { id: 1, title: "Komödie", genre_ids: [35], vote_average: 9 },
    { id: 2, title: "Action-Komödie", genre_ids: [28, 35], vote_average: 6 },
    { id: 3, title: "Schon gesehen", genre_ids: [28, 35], vote_average: 9 },
    { id: 2, title: "Action-Komödie", genre_ids: [28, 35], vote_average: 6 },
    { id: 4, title: "Action", genre_ids: [28], vote_average: 7 },
  ];
  const out = pickCandidates(movies, [[28, 35], [28]], [3]);
  assert.deepEqual(out.map((m) => m.id), [2, 4, 1]);
});

test("pickCandidates respektiert das Limit", () => {
  const movies = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, title: `F${i}` }));
  assert.equal(pickCandidates(movies, [], [], 30).length, 30);
});

test("releaseYear", () => {
  assert.equal(releaseYear("1999-03-31"), 1999);
  assert.equal(releaseYear(""), null);
  assert.equal(releaseYear(undefined), null);
});

test("franchiseKey erkennt Filmreihen", () => {
  assert.equal(franchiseKey("Der Herr der Ringe: Die Gefährten"), "herr der ringe");
  assert.equal(franchiseKey("Der Herr der Ringe - Die zwei Türme"), "herr der ringe");
  assert.equal(franchiseKey("Harry Potter und der Stein der Weisen"), "harry potter");
  assert.equal(franchiseKey("Harry Potter und die Kammer des Schreckens"), "harry potter");
  assert.equal(franchiseKey("Shrek 2"), franchiseKey("Shrek"));
  assert.notEqual(franchiseKey("Der Pate"), franchiseKey("Der König der Löwen"));
});

const lotr = [
  { tmdbId: 120, title: "Der Herr der Ringe: Die Gefährten", genreIds: [12, 14] },
  { tmdbId: 121, title: "Der Herr der Ringe: Die zwei Türme", genreIds: [12, 14] },
  { tmdbId: 122, title: "Der Herr der Ringe: Die Rückkehr des Königs", genreIds: [12, 14] },
];
const others = Array.from({ length: 12 }, (_, i) => ({ tmdbId: 1000 + i, title: `Film Nummer ${i}`, genreIds: [i % 4] }));
const others2 = others.map((m, i) => ({ ...m, title: ["Alien", "Heat", "Up", "Her", "Coco", "Rocky", "Jaws", "Fargo", "Drive", "Arrival", "Amélie", "Parasite"][i] }));

test("personalOrder zieht Filme derselben Reihe auseinander", () => {
  for (const seed of ["anna", "ben", "cem", "dana", "emil", "fritzi"]) {
    const order = personalOrder([...lotr, ...others2], seed);
    assert.equal(order.length, 15);
    assert.equal(new Set(order.map((m) => m.tmdbId)).size, 15);
    const pos = order.flatMap((m, i) => (m.tmdbId >= 120 && m.tmdbId <= 122 ? [i] : []));
    for (let k = 1; k < pos.length; k++) assert.ok(pos[k] - pos[k - 1] >= 5, `${seed}: ${pos}`);
  }
});

test("personalOrder ist pro Person stabil und unterscheidet sich zwischen Personen", () => {
  const movies = [...lotr, ...others2];
  const ids = (s: string) => personalOrder(movies, s).map((m) => m.tmdbId).join();
  assert.equal(ids("anna"), ids("anna"));
  assert.equal(ids("anna"), personalOrder([...movies].reverse(), "anna").map((m) => m.tmdbId).join());
  assert.notEqual(ids("anna"), ids("ben"));
});

test("personalOrder kommt mit nur einer Reihe klar", () => {
  assert.equal(personalOrder(lotr, "x").length, 3);
  assert.deepEqual(personalOrder([], "x"), []);
});
