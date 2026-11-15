import { test } from "node:test";
import assert from "node:assert/strict";
import { classicUntil, discoverParams, featuredRank, normalizeYears, franchiseKey, genreDemand, mixBuckets, personalOrder, pickCandidates, randomPage, releaseYear, streamableOn } from "../src/lib/candidates.ts";

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

test("discoverParams: keine Kinofilme, nur Abo/kostenlos/Werbung", () => {
  const p = discoverParams({ region: "DE", providerIds: [8], genreIds: [], page: 1, today: new Date("2026-11-14T12:00:00Z") });
  assert.equal(p.get("primary_release_date.lte"), "2026-09-15"); // 60 Tage vorher
  assert.equal(p.get("with_watch_monetization_types"), "flatrate|free|ads");
});

test("discoverParams: Töpfe für mehr als Blockbuster", () => {
  const today = new Date("2026-11-14T12:00:00Z");
  const q = (bucket: "popular" | "acclaimed" | "classic" | "gem") =>
    discoverParams({ region: "DE", providerIds: [8], genreIds: [], page: 1, bucket, today });
  assert.equal(q("popular").get("sort_by"), "popularity.desc");
  assert.equal(q("acclaimed").get("sort_by"), "vote_average.desc");
  assert.equal(q("classic").get("primary_release_date.lte"), "2005-12-31");
  assert.equal(q("gem").get("vote_count.lte"), "1500");
  assert.equal(q("gem").get("vote_average.gte"), "6.8");
});

test("randomPage bleibt innerhalb der vorhandenen Seiten", () => {
  assert.equal(randomPage("acclaimed", 1, () => 0.99), 1);
  assert.equal(randomPage("acclaimed", 0, () => 0.5), 1);
  assert.equal(randomPage("acclaimed", 400, () => 0.99), 12);
  assert.equal(randomPage("popular", 400, () => 0), 1);
});

test("streamableOn: nur Abo, kostenlos oder Werbung bei gewählten Diensten zählt", () => {
  assert.deepEqual(streamableOn({ flatrate: [{ provider_id: 8 }, { provider_id: 30 }] }, [8, 9]), [8]);
  assert.deepEqual(streamableOn({ ads: [{ provider_id: 9 }] }, [8, 9]), [9]);
  assert.deepEqual(streamableOn({ flatrate: [{ provider_id: 30 }] }, [8, 9]), []);
  assert.deepEqual(streamableOn({ rent: [{ provider_id: 8 }] } as never, [8]), [], "Leihen zählt nicht");
  assert.deepEqual(streamableOn(undefined, [8]), [], "keine Daten = nicht verfügbar");
});

test("mixBuckets nimmt abwechselnd aus jedem Topf und überspringt Doppelte", () => {
  const m = (id: number) => ({ id });
  const out = mixBuckets([[m(1), m(2), m(3)], [m(10), m(1)], [m(20)]], 5).map((x) => x.id);
  assert.deepEqual(out, [1, 10, 20, 2, 3]);
});

test("featuredRank erkennt bekannte Dienste, aber keine Varianten", () => {
  assert.equal(featuredRank("Netflix"), 0);
  assert.ok(featuredRank("Disney Plus") > 0);
  assert.ok(featuredRank("RTL+") > 0);
  assert.ok(featuredRank("Apple TV", 350) > 0, "Apple TV+ unter neuem Namen");
  assert.equal(featuredRank("Apple TV", 2), -1, "Apple-Store zum Leihen ist kein Abo");
  assert.equal(featuredRank("Netflix Standard with Ads"), -1);
  assert.equal(featuredRank("MUBI Amazon Channel"), -1);
});

test("Erscheinungsjahr: von/bis landen als Datumsgrenzen bei TMDB", () => {
  const today = new Date("2026-11-15T12:00:00Z");
  const p = discoverParams({ region: "DE", providerIds: [], genreIds: [], page: 1, years: { from: 2000, to: 2009 }, today });
  assert.equal(p.get("primary_release_date.gte"), "2000-01-01");
  assert.equal(p.get("primary_release_date.lte"), "2009-12-31");
  // ohne Zeitraum keine Untergrenze, Obergrenze bleibt die Kino-Sperre
  const q = discoverParams({ region: "DE", providerIds: [], genreIds: [], page: 1, today });
  assert.equal(q.has("primary_release_date.gte"), false);
  assert.equal(q.get("primary_release_date.lte"), "2026-09-16");
});

test("Erscheinungsjahr: Kino-Sperre gilt auch mit 'bis' in der Zukunft", () => {
  const today = new Date("2026-11-15T12:00:00Z");
  const p = discoverParams({ region: "DE", providerIds: [], genreIds: [], page: 1, years: { from: 2020, to: 2030 }, today });
  assert.equal(p.get("primary_release_date.lte"), "2026-09-16");
});

test("Klassiker-Topf passt sich dem Zeitraum an", () => {
  const today = new Date("2026-11-15T12:00:00Z");
  const classic = (years: { from: number | null; to: number | null }) =>
    discoverParams({ region: "DE", providerIds: [], genreIds: [], page: 1, bucket: "classic", years, today }).get("primary_release_date.lte");
  assert.equal(classic({ from: null, to: null }), "2005-12-31");
  assert.equal(classic({ from: 1980, to: 1995 }), "1987-12-31");
  // "ab 2010": ältere Hälfte des Zeitraums statt eines leeren Topfs
  assert.equal(classic({ from: 2010, to: null }), "2018-12-31");
  assert.equal(classicUntil({ from: 2020, to: 2020 }, 2026), 2020);
});

test("normalizeYears säubert die Eingabe", () => {
  assert.deepEqual(normalizeYears({ from: 2010, to: 1990 }), { from: 1990, to: 2010 });
  assert.deepEqual(normalizeYears({ from: 1800, to: 2000.5 }), { from: null, to: null });
  assert.deepEqual(normalizeYears(null), { from: null, to: null });
});
