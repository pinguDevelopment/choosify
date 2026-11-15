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

/** Englische Namen der TMDB-Filmgenres (wie TMDB sie mit language=en-US liefert, etwas gekürzt). */
export const GENRE_NAMES_EN: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

/** Sprachen, für die es Genre- und Tag-Namen gibt (Deutsch ist die Grundlage). */
export type TagLocale = "de" | "en";

const GENRES_BY_LOCALE: Record<TagLocale, Record<number, string>> = { de: GENRE_NAMES, en: GENRE_NAMES_EN };

/** Genre-Namen in TMDB-Reihenfolge (das wichtigste Genre steht vorne), unbekannte IDs fallen weg. */
export function genreNames(ids: readonly number[] | null | undefined, max = 3, locale: TagLocale = "de"): string[] {
  const names = GENRES_BY_LOCALE[locale];
  return [...new Set(ids ?? [])].flatMap((id) => (names[id] ? [names[id]] : [])).slice(0, max);
}

/** Stimmung pro Genre: so würde man den Film in einem Satz beschreiben. */
export const GENRE_MOOD: Record<number, string> = {
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

/** Alle Tags, die movieTags() vergeben kann (für Übersetzungen und Tests). */
export const ALL_TAGS: readonly string[] = [
  ...new Set([...Object.values(GENRE_MOOD), ...KEYWORD_TAGS.map(([tag]) => tag), "klassiker", "topbewertet"]),
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

/**
 * Anzeige der Tags auf Englisch. Gespeichert werden immer die deutschen Schlüssel (Datenbank,
 * Geschmack der Crew), übersetzt wird erst bei der Ausgabe.
 */
export const TAG_LABELS_EN: Record<string, string> = {
  action: "action",
  abenteuer: "adventure",
  animiert: "animated",
  lustig: "funny",
  krimi: "crime",
  doku: "docu",
  drama: "drama",
  familie: "family",
  fantasy: "fantasy",
  historisch: "historical",
  gruselig: "creepy",
  musik: "music",
  rätselhaft: "mysterious",
  romantisch: "romantic",
  scifi: "scifi",
  spannend: "thrilling",
  krieg: "war",
  western: "western",
  wahregeschichte: "truestory",
  buchverfilmung: "basedonbook",
  superhelden: "superheroes",
  comic: "comic",
  plottwist: "plottwist",
  taschentücher: "tearjerker",
  feelgood: "feelgood",
  schwarzerhumor: "darkhumor",
  romcom: "romcom",
  kultfilm: "cultclassic",
  parodie: "parody",
  zeitreise: "timetravel",
  weltraum: "space",
  aliens: "aliens",
  dystopie: "dystopia",
  ki: "ai",
  roboter: "robots",
  zombies: "zombies",
  vampire: "vampires",
  geister: "ghosts",
  monster: "monsters",
  slasher: "slasher",
  serienkiller: "serialkiller",
  psycho: "psycho",
  raubzug: "heist",
  gangster: "gangsters",
  spionage: "spies",
  rache: "revenge",
  überleben: "survival",
  katastrophe: "disaster",
  kampfkunst: "martialarts",
  magie: "magic",
  drachen: "dragons",
  dinosaurier: "dinosaurs",
  piraten: "pirates",
  mittelalter: "medieval",
  freundschaft: "friendship",
  erwachsenwerden: "comingofage",
  schule: "school",
  roadtrip: "roadtrip",
  sport: "sports",
  tierisch: "animals",
  weihnachten: "christmas",
  musical: "musical",
  anime: "anime",
  gerichtsdrama: "courtroom",
  queer: "queer",
  klassiker: "classic",
  topbewertet: "toprated",
};

/** Tag in der Sprache der Oberfläche (ohne "#"). Unbekannte Tags bleiben, wie sie sind. */
export function tagLabel(tag: string, locale: TagLocale = "de"): string {
  return locale === "en" ? (TAG_LABELS_EN[tag] ?? tag) : tag;
}

/** Für die Datenbank: nur Kleinbuchstaben (inkl. Umlaute), kurz. */
export const TAG_PATTERN = /^[a-zäöüß]{2,24}$/;
