import { test } from "node:test";
import assert from "node:assert/strict";
import { rankMovies, runoffResult, tiedLeaders } from "../src/lib/ranking.ts";

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

test("rankMovies: gleiche Reihenfolge wie früher die SQL-Funktion room_ranking", () => {
  const movies = [
    { tmdbId: 1, position: 1, voteAverage: 6 },
    { tmdbId: 2, position: 2, voteAverage: 6 },
    { tmdbId: 3, position: 3, voteAverage: 9 },
    { tmdbId: 4, position: 4, voteAverage: 5 },
    { tmdbId: 5, position: 5, voteAverage: 9 },
  ];
  const v = (tmdbId: number, ...choices: number[]) => choices.map((choice) => ({ tmdbId, choice }));
  const votes = [...v(1, 1, 1, 1), ...v(2, 1, 1, 0), ...v(3, 1, 1, -1), ...v(4, 0, 0, 0), ...v(5, -1)];
  const r = rankMovies(movies, votes, 3);
  assert.deepEqual(r.map((x) => x.movie.tmdbId), [1, 2, 4, 3]);
  assert.deepEqual(
    r.map((x) => [x.likes, x.maybes, x.dislikes, x.unanimous, x.acceptable, x.score]),
    [[3, 0, 0, true, true, 6], [2, 1, 0, false, true, 5], [0, 3, 0, false, true, 3], [2, 0, 1, false, false, 4]],
  );
});

test("rankMovies: bei Gleichstand entscheidet die TMDB-Bewertung, ohne Bewertung zuletzt", () => {
  const movies = [
    { tmdbId: 1, position: 0, voteAverage: null },
    { tmdbId: 2, position: 1, voteAverage: 7.5 },
  ];
  const r = rankMovies(movies, [{ tmdbId: 1, choice: 1 }, { tmdbId: 2, choice: 1 }], 2);
  assert.deepEqual(r.map((x) => x.movie.tmdbId), [2, 1]);
});
