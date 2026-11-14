import "server-only";

// Testdaten für lokale Entwicklung und automatische Tests ohne TMDB-Zugang.
const genres = [
  { id: 28, name: "Action" },
  { id: 35, name: "Komödie" },
  { id: 18, name: "Drama" },
  { id: 27, name: "Horror" },
  { id: 878, name: "Science Fiction" },
  { id: 10749, name: "Liebesfilm" },
  { id: 16, name: "Animation" },
  { id: 53, name: "Thriller" },
];

const providers = [
  { provider_id: 8, provider_name: "Netflix", logo_path: null, display_priorities: { DE: 1 } },
  { provider_id: 9, provider_name: "Amazon Prime Video", logo_path: null, display_priorities: { DE: 2 } },
  { provider_id: 337, provider_name: "Disney Plus", logo_path: null, display_priorities: { DE: 3 } },
  { provider_id: 350, provider_name: "Apple TV+", logo_path: null, display_priorities: { DE: 4 } },
  { provider_id: 30, provider_name: "WOW", logo_path: null, display_priorities: { DE: 9 } },
  { provider_id: 1796, provider_name: "Netflix Standard with Ads", logo_path: null, display_priorities: { DE: 5 } },
  { provider_id: 2, provider_name: "Apple TV", logo_path: null, display_priorities: { DE: 6 } },
  { provider_id: 201, provider_name: "MUBI Amazon Channel", logo_path: null, display_priorities: { DE: 7 } },
];

/** Jeder 4. Testfilm ist nirgends im Abo, sondern nur zum Leihen (z. B. noch im Kino). */
export const mockOnlyRent = (id: number) => id % 4 === 3;

const movies = Array.from({ length: 60 }, (_, i) => {
  const g = genres[i % genres.length].id;
  const g2 = genres[(i * 3 + 1) % genres.length].id;
  return {
    id: 1000 + i,
    title: `Testfilm ${i + 1}`,
    overview: `Beschreibung von Testfilm ${i + 1}.`,
    poster_path: null,
    release_date: `${1990 + (i % 35)}-01-01`,
    vote_average: Math.round((5 + ((i * 7) % 45) / 10) * 10) / 10,
    vote_count: 500,
    popularity: 100 - i,
    genre_ids: g === g2 ? [g] : [g, g2],
  };
});

// Echte TMDB-Schlagwörter (englisch), teils ohne passenden deutschen Tag
const mockKeywords = [
  ["time travel", "friendship", "sequel"],
  ["based on true story", "biography"],
  ["twist ending", "serial killer", "police"],
  ["based on novel or book", "magic", "dragon"],
  ["feel-good", "road trip"],
  ["new york city"],
  ["dystopia", "artificial intelligence (a.i.)", "robot"],
];

function watchProviders(id: number) {
  if (mockOnlyRent(id)) return { results: { DE: { rent: [{ provider_id: 2 }] } } };
  return { results: { DE: { flatrate: [{ provider_id: [8, 9, 337, 350][id % 4] }, { provider_id: 30 }] } } };
}

export function mockTmdb(path: string, params: URLSearchParams): unknown {
  if (path === "/genre/movie/list") return { genres };
  if (path === "/watch/providers/movie") return { results: providers };
  if (path === "/search/movie") {
    const q = (params.get("query") ?? "").toLowerCase();
    return { results: movies.filter((m) => m.title.toLowerCase().includes(q)) };
  }
  const single = path.match(/^\/movie\/(\d+)$/);
  if (single) {
    const id = Number(single[1]);
    const m = movies.find((x) => x.id === id);
    if (!m) throw new Error("Mock: Film nicht gefunden");
    if (!params.get("append_to_response")) return m;
    return {
      ...m,
      runtime: 85 + (id % 7) * 11,
      keywords: { keywords: mockKeywords[id % mockKeywords.length].map((name) => ({ name })) },
      "watch/providers": watchProviders(id),
    };
  }
  if (path === "/discover/movie") {
    const want = (params.get("with_genres") ?? "").split("|").filter(Boolean).map(Number);
    const page = Number(params.get("page") ?? 1);
    const hits = movies.filter((m) => !want.length || m.genre_ids.some((g) => want.includes(g)));
    return { results: hits.slice((page - 1) * 20, page * 20), total_pages: Math.ceil(hits.length / 20) };
  }
  throw new Error(`Mock: unbekannter Pfad ${path}`);
}
