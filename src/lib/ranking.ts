// Reine Logik für "genau ein Gewinner", ohne Server-Abhängigkeiten.

export type RankKey = { tmdbId: number; unanimous: boolean; acceptable: boolean; likes: number; maybes: number; dislikes: number };

export const MAX_RUNOFF = 4;

/**
 * Filme, die vorne gleichauf liegen (gleiche Stufe, gleiche Punkte, gleich viele Neins).
 * Die Rangliste kommt schon sortiert aus der Datenbank. Mehr als ein Eintrag heißt: Stichwahl.
 */
export function tiedLeaders<T extends RankKey>(ranking: T[]): T[] {
  const [first] = ranking;
  if (!first) return [];
  const score = (r: RankKey) => r.likes * 2 + r.maybes;
  return ranking
    .filter(
      (r) =>
        r.unanimous === first.unanimous &&
        r.acceptable === first.acceptable &&
        score(r) === score(first) &&
        r.dislikes === first.dislikes,
    )
    .slice(0, MAX_RUNOFF);
}

/**
 * Auswertung der Stichwahl: meiste Stimmen gewinnt. Steht es dann immer noch gleich,
 * entscheidet die Reihenfolge der Kandidaten (also die TMDB-Bewertung aus der Rangliste).
 */
export function runoffResult(candidates: number[], picks: number[]) {
  const tally: Record<number, number> = Object.fromEntries(candidates.map((id) => [id, 0]));
  for (const p of picks) if (p in tally) tally[p]++;
  let winner: number | null = null;
  for (const id of candidates) if (winner === null || tally[id] > tally[winner]) winner = id;
  const best = winner === null ? 0 : tally[winner];
  const stillTied = candidates.filter((id) => tally[id] === best).length > 1;
  return { winner, tally, stillTied };
}
