// Genres und Stimmungs-Tags für die Abstimmkarten. Reine Logik ohne Server-Abhängigkeiten.

/**
 * Deutsche Namen der TMDB-Filmgenres. Die IDs sind bei TMDB fest, deshalb reicht eine
 * Tabelle und die Karten brauchen keinen zusätzlichen Abruf.
 */
export const GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Abenteuer",
  16: "Animation",
  35: "Komödie",
  80: "Krimi",
  99: "Doku",
  18: "Drama",
  10751: "Familie",
  14: "Fantasy",
  36: "Historie",
  27: "Horror",
  10402: "Musik",
  9648: "Mystery",
  10749: "Liebesfilm",
  878: "Science-Fiction",
  10770: "TV-Film",
  53: "Thriller",
  10752: "Kriegsfilm",
  37: "Western",
};

/** Genre-Namen in TMDB-Reihenfolge (das wichtigste Genre steht vorne), unbekannte IDs fallen weg. */
export function genreNames(ids: readonly number[] | null | undefined, max = 3): string[] {
  return [...new Set(ids ?? [])].flatMap((id) => (GENRE_NAMES[id] ? [GENRE_NAMES[id]] : [])).slice(0, max);
}

/** Stimmung pro Genre: so würde man den Film in einem Satz beschreiben. */
const GENRE_MOOD: Record<number, string> = {
  28: "action",
  12: "abenteuer",
  16: "animiert",
  35: "lustig",
  80: "krimi",
  99: "doku",
  18: "drama",
  10751: "familie",
  14: "fantasy",
  36: "historisch",
  27: "gruselig",
  10402: "musik",
  9648: "rätselhaft",
  10749: "romantisch",
  878: "scifi",
  53: "spannend",
  10752: "krieg",
  37: "western",
};

/**
 * TMDB-Schlagwörter (englisch) -> kuratierte deutsche Tags. Nur was hier steht, landet auf
 * der Karte; rohe englische Schlagwörter werden nie angezeigt.
 */
const KEYWORD_TAGS: [tag: string, keywords: string[]][] = [
  ["wahregeschichte", ["based on true story", "based on real person", "biography", "true crime"]],
  ["buchverfilmung", ["based on novel or book", "based on novel", "based on book", "based on young adult novel"]],
  ["superhelden", ["superhero", "superhero team", "marvel cinematic universe (mcu)", "dc extended universe (dceu)"]],
  ["comic", ["based on comic", "based on graphic novel", "based on manga"]],
  ["plottwist", ["twist ending", "plot twist"]],
  ["taschentücher", ["tearjerker"]],
  ["feelgood", ["feel-good", "feel good", "heartwarming"]],
  ["schwarzerhumor", ["dark comedy", "black comedy"]],
  ["romcom", ["romantic comedy"]],
  ["kultfilm", ["cult film"]],
  ["parodie", ["parody", "spoof"]],
  ["zeitreise", ["time travel", "time loop"]],
  ["weltraum", ["space", "outer space", "space travel", "astronaut", "spaceship"]],
  ["aliens", ["alien", "alien invasion", "extraterrestrial"]],
  ["dystopie", ["dystopia", "post-apocalyptic future", "post-apocalyptic", "apocalypse"]],
  ["ki", ["artificial intelligence (a.i.)", "artificial intelligence"]],
  ["roboter", ["robot", "android", "cyborg"]],
  ["zombies", ["zombie", "zombie apocalypse"]],
  ["vampire", ["vampire"]],
  ["geister", ["ghost", "haunted house", "haunting"]],
  ["monster", ["monster", "giant monster", "kaiju", "creature"]],
  ["slasher", ["slasher"]],
  ["serienkiller", ["serial killer"]],
  ["psycho", ["psychological thriller", "psychopath"]],
  ["raubzug", ["heist", "bank robbery", "robbery"]],
  ["gangster", ["mafia", "gangster", "organized crime"]],
  ["spionage", ["spy", "secret agent", "espionage", "cia"]],
  ["rache", ["revenge"]],
  ["überleben", ["survival"]],
  ["katastrophe", ["disaster", "natural disaster"]],
  ["kampfkunst", ["martial arts", "kung fu"]],
  ["magie", ["magic", "wizard", "witch", "sorcery"]],
  ["drachen", ["dragon"]],
  ["dinosaurier", ["dinosaur"]],
  ["piraten", ["pirate"]],
  ["mittelalter", ["medieval"]],
  ["freundschaft", ["friendship", "best friend"]],
  ["erwachsenwerden", ["coming of age"]],
  ["schule", ["high school", "school"]],
  ["roadtrip", ["road trip", "road movie"]],
  ["sport", ["sports", "boxing", "football (soccer)", "basketball", "baseball"]],
  ["tierisch", ["dog", "talking animal", "animal"]],
  ["weihnachten", ["christmas"]],
  ["musical", ["musical"]],
  ["anime", ["anime"]],
  ["gerichtsdrama", ["courtroom", "lawyer"]],
  ["queer", ["lgbt", "gay theme", "lesbian"]],
];

const KEYWORD_INDEX = new Map<string, string>();
for (const [tag, kws] of KEYWORD_TAGS) for (const kw of kws) KEYWORD_INDEX.set(kw, tag);

export type TagInput = {
  genreIds: readonly number[] | null | undefined;
  /** TMDB-Schlagwörter, englisch, Reihenfolge wie von TMDB */
  keywords?: readonly string[];
  year?: number | null;
  rating?: number | null;
};

/**
 * 2 bis 4 deutsche Tags pro Film, ohne "#":
 *  1. Stimmung des Hauptgenres (#lustig, #gruselig, …)
 *  2. bis zu zwei Tags aus den Schlagwörtern (#zeitreise, #wahregeschichte, …)
 *  3. Stimmung der weiteren Genres
 *  4. wenn es dann noch weniger als zwei sind: #klassiker bzw. #topbewertet
 */
export function movieTags({ genreIds, keywords = [], year, rating }: TagInput, max = 4): string[] {
  const out: string[] = [];
  const add = (t: string | undefined) => {
    if (t && !out.includes(t) && out.length < max) out.push(t);
  };
  const moods = [...new Set(genreIds ?? [])].map((g) => GENRE_MOOD[g]).filter(Boolean);
  const fromKeywords = [...new Set(keywords.map((k) => KEYWORD_INDEX.get(k.trim().toLowerCase())).filter(Boolean))];
  const ids = new Set(genreIds ?? []);
  // Komödie + Liebesfilm ist eine RomCom, auch wenn TMDB das Schlagwort nicht gesetzt hat
  if (ids.has(35) && ids.has(10749) && !fromKeywords.includes("romcom")) fromKeywords.push("romcom");

  add(moods[0]);
  for (const t of fromKeywords.slice(0, 2)) add(t);
  for (const t of moods.slice(1)) add(t);
  for (const t of fromKeywords.slice(2)) add(t);
  if (out.length < 2 && year != null && year < 1990) add("klassiker");
  if (out.length < 2 && rating != null && rating >= 8) add("topbewertet");
  return out;
}

/** Für die Datenbank: nur Kleinbuchstaben (inkl. Umlaute), kurz. */
export const TAG_PATTERN = /^[a-zäöüß]{2,24}$/;
