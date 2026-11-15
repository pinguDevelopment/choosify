// Geschmack einer Crew aus den Sternen im Abspann. Reine Logik ohne Server-Abhängigkeiten.
import { GENRE_MOOD, genreNames, tagLabel, type TagLocale } from "./tags.ts";

/** Stimmungs-Tags wie #lustig sagen dasselbe wie das Genre und zählen deshalb nicht extra. */
const MOOD_TAGS = new Set(Object.values(GENRE_MOOD));

export type RatedFilm = { genreIds: readonly number[]; tags: readonly string[]; stars: readonly number[] };

export type Taste = {
  /** -1 (mögen wir gar nicht) bis +1 (lieben wir) pro Genre bzw. Tag */
  genres: Map<number, number>;
  tags: Map<string, number>;
  /** wie viele bewertete Filme eingeflossen sind */
  rated: number;
};

export const EMPTY_TASTE: Taste = { genres: new Map(), tags: new Map(), rated: 0 };

/** Durchschnitt der Sterne, auf eine Nachkommastelle gerundet (null ohne Bewertungen). */
export function averageStars(stars: readonly number[]): number | null {
  if (!stars.length) return null;
  return Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10;
}

/**
 * Pro Film zählt der Abstand des Durchschnitts zur Mitte (3 Sterne): 5 Sterne = +1, 1 Stern = -1.
 * Ein Genre bekommt den Mittelwert über seine Filme, gedämpft durch einen gedachten neutralen
 * Film (+1 im Nenner). So kippt ein einzelner Ausreißer nicht gleich den ganzen Geschmack.
 */
export function crewTaste(films: readonly RatedFilm[]): Taste {
  const sum = { genres: new Map<number, number>(), tags: new Map<string, number>() };
  const cnt = { genres: new Map<number, number>(), tags: new Map<string, number>() };
  let rated = 0;
  for (const f of films) {
    const avg = averageStars(f.stars.filter((s) => s >= 1 && s <= 5));
    if (avg == null) continue;
    rated++;
    const w = (avg - 3) / 2;
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
  return { genres: damp(sum.genres, cnt.genres), tags: damp(sum.tags, cnt.tags), rated };
}

/**
 * Wie gut passt ein Film zum Geschmack der Crew? -1 bis +1.
 * Genres und Tags zählen je zur Hälfte, jeweils der Mittelwert über die bekannten Einträge.
 * Ohne Tags (vor dem Detail-Abruf) zählen nur die Genres.
 */
export function tasteBoost(taste: Taste, genreIds: readonly number[] = [], tags: readonly string[] = []): number {
  if (!taste.rated) return 0;
  const mean = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const g = mean([...new Set(genreIds)].flatMap((id) => (taste.genres.has(id) ? [taste.genres.get(id)!] : [])));
  const t = mean([...new Set(tags)].flatMap((tag) => (taste.tags.has(tag) ? [taste.tags.get(tag)!] : [])));
  return Math.max(-1, Math.min(1, tags.length ? (g + t) / 2 : g));
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
