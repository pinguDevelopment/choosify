import { test } from "node:test";
import assert from "node:assert/strict";
import { runoffResult, tiedLeaders } from "../src/lib/ranking.ts";

const row = (tmdbId: number, likes: number, maybes: number, dislikes: number, n = 3) => ({
  tmdbId,
  likes,
  maybes,
  dislikes,
  unanimous: likes === n,
  acceptable: dislikes === 0 && likes + maybes === n,
});

test("tiedLeaders: drei Filme mit alle ♥ landen in der Stichwahl", () => {
  const r = [row(1, 3, 0, 0), row(2, 3, 0, 0), row(3, 3, 0, 0), row(4, 2, 1, 0)];
  assert.deepEqual(tiedLeaders(r).map((x) => x.tmdbId), [1, 2, 3]);
});

test("tiedLeaders: klarer Sieger braucht keine Stichwahl", () => {
  assert.deepEqual(tiedLeaders([row(1, 3, 0, 0), row(2, 2, 1, 0)]).map((x) => x.tmdbId), [1]);
  assert.deepEqual(tiedLeaders([]), []);
});

test("tiedLeaders: gleiche Punkte, aber ein Nein mehr ist kein Gleichstand", () => {
  // 2 Ja + 1 Nein (4 Punkte, 1 Nein) gegen 1 Ja + 2 ok (4 Punkte, alle dabei): alle dabei liegt vorne
  const r = [row(1, 1, 2, 0), row(2, 2, 0, 1)];
  assert.deepEqual(tiedLeaders(r).map((x) => x.tmdbId), [1]);
});

test("tiedLeaders: höchstens 4 Filme in der Stichwahl", () => {
  const r = Array.from({ length: 7 }, (_, i) => row(i + 1, 3, 0, 0));
  assert.equal(tiedLeaders(r).length, 4);
});

test("runoffResult: meiste Stimmen gewinnt", () => {
  const r = runoffResult([10, 20, 30], [20, 30, 20]);
  assert.equal(r.winner, 20);
  assert.deepEqual(r.tally, { 10: 0, 20: 2, 30: 1 });
  assert.equal(r.stillTied, false);
});

test("runoffResult: Gleichstand entscheidet die Reihenfolge (TMDB-Bewertung)", () => {
  const r = runoffResult([10, 20, 30], [30, 20]);
  assert.equal(r.winner, 20);
  assert.equal(r.stillTied, true);
  assert.equal(runoffResult([10, 20], []).winner, 10);
  assert.equal(runoffResult([], []).winner, null);
});

test("runoffResult: Stimmen für fremde Filme zählen nicht", () => {
  assert.equal(runoffResult([10, 20], [99, 99, 20]).winner, 20);
});
