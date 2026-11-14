import { test } from "node:test";
import assert from "node:assert/strict";
import { GENRE_NAMES, TAG_PATTERN, genreNames, movieTags } from "../src/lib/tags.ts";

test("genreNames: deutsche Namen, Reihenfolge bleibt, Unbekanntes fällt weg", () => {
  assert.deepEqual(genreNames([878, 18, 99999]), ["Science-Fiction", "Drama"]);
  assert.deepEqual(genreNames([28, 12, 35, 80]), ["Action", "Abenteuer", "Komödie"]);
  assert.deepEqual(genreNames(null), []);
});

test("movieTags: Hauptgenre-Stimmung, dann Schlagwörter, dann weitere Genres", () => {
  const tags = movieTags({ genreIds: [878, 18], keywords: ["time travel", "Friendship", "sequel"] });
  assert.deepEqual(tags, ["scifi", "zeitreise", "freundschaft", "drama"]);
});

test("movieTags: höchstens 4, keine Doppelten, keine rohen englischen Schlagwörter", () => {
  const tags = movieTags({
    genreIds: [35, 35, 18, 10749, 28],
    keywords: ["new york city", "heist", "robbery", "revenge", "twist ending"],
  });
  assert.equal(tags.length, 4);
  assert.equal(new Set(tags).size, 4);
  assert.ok(!tags.includes("new york city"));
  assert.deepEqual(tags.slice(0, 3), ["lustig", "raubzug", "rache"]);
});

test("movieTags: Komödie + Liebesfilm ergibt #romcom", () => {
  assert.deepEqual(movieTags({ genreIds: [35, 10749] }), ["lustig", "romcom", "romantisch"]);
});

test("movieTags: wenig Daten -> Klassiker bzw. topbewertet auffüllen", () => {
  assert.deepEqual(movieTags({ genreIds: [27], year: 1978 }), ["gruselig", "klassiker"]);
  assert.deepEqual(movieTags({ genreIds: [18], year: 2015, rating: 8.4 }), ["drama", "topbewertet"]);
  assert.deepEqual(movieTags({ genreIds: [18], year: 2015, rating: 6.1 }), ["drama"]);
  assert.deepEqual(movieTags({ genreIds: [] }), []);
});

test("alle möglichen Tags passen zum erlaubten Muster", () => {
  const all = new Set<string>();
  for (const id of Object.keys(GENRE_NAMES)) for (const t of movieTags({ genreIds: [Number(id)] })) all.add(t);
  const kws = ["based on true story", "superhero", "feel-good", "artificial intelligence (a.i.)", "football (soccer)", "survival", "tearjerker"];
  for (const k of kws) for (const t of movieTags({ genreIds: [], keywords: [k], year: 1970, rating: 9 })) all.add(t);
  for (const t of all) assert.match(t, TAG_PATTERN, t);
});
