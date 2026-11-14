import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverParams, genreDemand, pickCandidates, releaseYear } from "../src/lib/candidates.ts";

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
