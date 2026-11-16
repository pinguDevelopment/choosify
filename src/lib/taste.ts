// Geschmack einer Crew (Sterne im Abspann) bzw. einer Person („Train my Algorithm“). Reine Logik ohne Server-Abhängigkeiten.
import { GENRE_MOOD, genreNames, tagLabel, type TagLocale } from "./tags.ts";

/** Stimmungs-Tags wie #lustig sagen dasselbe wie das Genre und zählen deshalb nicht extra. */
const MOOD_TAGS = new Set(Object.values(GENRE_MOOD));

export type RatedFilm = { genreIds: readonly number[]; tags: readonly string[]; stars: readonly number[] };
/** Ein Film mit Gewicht von -1 (gar nicht) bis +1 (sehr gerne). */
export type WeightedFilm = { tmdbId?: number; genreIds: readonly number[]; tags: readonly string[]; w: number };

export type Taste = {
  /** -1 (mögen wir gar nicht) bis +1 (lieben wir) pro Genre bzw. Tag */
  genres: Map<number, number>;
  tags: Map<string, number>;
  /** wie viele bewertete Filme eingeflossen sind */
  rated: number;
  /** direkte Meinung zu einzelnen Filmen (nur beim persönlichen Training) */
  films?: Map<number, number>;
};

export const EMPTY_TASTE: Taste = { genres: new Map(), tags: new Map(), rated: 0 };

/** Durchschnitt der Sterne, auf eine Nachkommastelle gerundet (null ohne Bewertungen). */
export function averageStars(stars: readonly number[]): number | null {
  if (!stars.length) return null;
  return Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10;
}

/**
 * Geschmack aus gewichteten Filmen: Ein Genre bekommt den Mittelwert über seine Filme, gedämpft
 * durch einen gedachten neutralen Film (+1 im Nenner). So kippt ein einzelner Ausreißer nicht
 * gleich den ganzen Geschmack.
 */
export function tasteOf(films: readonly WeightedFilm[]): Taste {
  const sum = { genres: new Map<number, number>(), tags: new Map<string, number>() };
  const cnt = { genres: new Map<number, number>(), tags: new Map<string, number>() };
  const direct = new Map<number, number>();
  let rated = 0;
  for (const f of films) {
    const w = Math.max(-1, Math.min(1, f.w));
    rated++;
    if (f.tmdbId) direct.set(f.tmdbId, w);
    for (const g of new Set(f.genreIds)) {
      sum.genres.set(g, (sum.genres.get(g) ?? 0) + w);
      cnt.genres.set(g, (cnt.genres.get(g) ?? 0) + 1);
    }
    for (const t of new Set(f.tags.filter((t) => !MOOD_TAGS.has(t)))) {
      sum.tags.set(t, (sum.tags.get(t) ?? 0) + w);
      cnt.tags.set(t, (cnt.tags.get(t) ?? 0) + 1);
    }
  }
  const damp = <K>(s: Map<K, number>, c: Map<K, number>) =>
    new Map([...s].map(([k, v]) => [k, v / (c.get(k)! + 1)] as [K, number]));
  return { genres: damp(sum.genres, cnt.genres), tags: damp(sum.tags, cnt.tags), rated, ...(direct.size ? { films: direct } : {}) };
}

/** Pro Film zählt der Abstand des Sterne-Durchschnitts zur Mitte (3 Sterne): 5 Sterne = +1, 1 Stern = -1. */
export function crewTaste(films: readonly RatedFilm[]): Taste {
  return tasteOf(
    films.flatMap((f) => {
      const avg = averageStars(f.stars.filter((s) => s >= 1 && s <= 5));
      return avg == null ? [] : [{ genreIds: f.genreIds, tags: f.tags, w: (avg - 3) / 2 }];
    }),
  );
}

/** Gewicht einer Trainings-Stimme: Mag ich = +1, Geht so = 0 (zieht Richtung neutral), Nicht meins = -1. */
export const TRAINING_WEIGHT: Record<number, number> = { 1: 1, 0: 0, [-1]: -1 };

/** Persönlicher Geschmack aus „Train my Algorithm“. */
export function personalTaste(votes: readonly { tmdbId: number; choice: number; genreIds: readonly number[]; tags: readonly string[] }[]): Taste {
  return tasteOf(votes.map((v) => ({ tmdbId: v.tmdbId, genreIds: v.genreIds, tags: v.tags, w: TRAINING_WEIGHT[v.choice] ?? 0 })));
}

/**
 * Wie gut passt ein Film zum Geschmack? -1 bis +1.
 * Genres und Tags zählen je zur Hälfte, jeweils der Mittelwert über die bekannten Einträge.
 * Ohne Tags (vor dem Detail-Abruf) zählen nur die Genres.
 * Wurde genau dieser Film schon trainiert, zählt die eigene Meinung dazu doppelt so viel.
 */
export function tasteBoost(taste: Taste, genreIds: readonly number[] = [], tags: readonly string[] = [], tmdbId?: number): number {
  if (!taste.rated) return 0;
  const mean = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const g = mean([...new Set(genreIds)].flatMap((id) => (taste.genres.has(id) ? [taste.genres.get(id)!] : [])));
  const t = mean([...new Set(tags)].flatMap((tag) => (taste.tags.has(tag) ? [taste.tags.get(tag)!] : [])));
  const general = tags.length ? (g + t) / 2 : g;
  const own = tmdbId != null ? taste.films?.get(tmdbId) : undefined;
  return Math.max(-1, Math.min(1, own != null ? (2 * own + general) / 3 : general));
}

/**
 * Geschmack einer ganzen Runde: Crew (Sterne im Abspann) und alle, die trainiert haben.
 * Die Trainierten zählen gemittelt, damit eine einzelne Person die Runde nicht dominiert;
 * Crew und Personen dann je zur Hälfte. Ohne irgendwelche Daten: null (nichts umsortieren).
 */
export function groupBooster(crew: Taste, people: readonly Taste[]) {
  const trained = people.filter((p) => p.rated > 0);
  if (!crew.rated && !trained.length) return null;
  const mean = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;
  return (genreIds: readonly number[] = [], tags: readonly string[] = [], tmdbId?: number) => {
    const parts: number[] = [];
    if (crew.rated) parts.push(tasteBoost(crew, genreIds, tags));
    if (trained.length) parts.push(mean(trained.map((p) => tasteBoost(p, genreIds, tags, tmdbId))));
    return mean(parts);
  };
}

/**
 * Sanftes Umsortieren: Jeder Film darf je nach Geschmack um bis zu `shift` Plätze nach vorne
 * oder hinten rücken. Die Mischung aus den Töpfen bleibt dabei weitgehend erhalten.
 */
export function tasteRerank<T>(items: readonly T[], boost: (item: T) => number, shift = 8): T[] {
  return items
    .map((item, i) => ({ item, key: i - boost(item) * shift, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.item);
}

/** Für die Anzeige im Abspann: was die Crew mag und was eher nicht (deutliche Ausschläge). */
export function tasteSummary(taste: Taste, max = 4, threshold = 0.2, locale: TagLocale = "de") {
  const entries = [
    ...[...taste.genres].flatMap(([id, v]) => genreNames([id], 1, locale).map((label) => ({ label, v }))),
    ...[...taste.tags].map(([tag, v]) => ({ label: `#${tagLabel(tag, locale)}`, v })),
  ];
  const pick = (list: typeof entries) => list.slice(0, max).map((e) => e.label);
  return {
    likes: pick(entries.filter((e) => e.v >= threshold).sort((a, b) => b.v - a.v)),
    dislikes: pick(entries.filter((e) => e.v <= -threshold).sort((a, b) => a.v - b.v)),
  };
}
