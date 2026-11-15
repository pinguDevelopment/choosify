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

export type RankMovie = { tmdbId: number; position: number; voteAverage: number | null };
export type RankVote = { tmdbId: number; choice: number };

/**
 * Rangliste einer Runde (früher die SQL-Funktion room_ranking, jetzt für alle Datenbanken gleich):
 * zuerst "alle wollen", dann "alle sind dabei" (niemand Nein), dann Punkte (Ja = 2, wäre ok = 1),
 * dann weniger Neins, dann TMDB-Bewertung. Filme ganz ohne Ja/ok fehlen.
 */
export function rankMovies<M extends RankMovie>(movies: M[], votes: RankVote[], participants: number) {
  const tally = new Map<number, { likes: number; maybes: number; dislikes: number }>();
  for (const v of votes) {
    const t = tally.get(v.tmdbId) ?? { likes: 0, maybes: 0, dislikes: 0 };
    if (v.choice === 1) t.likes++;
    else if (v.choice === 0) t.maybes++;
    else if (v.choice === -1) t.dislikes++;
    tally.set(v.tmdbId, t);
  }
  const n = participants;
  return movies
    .map((m) => {
      const { likes, maybes, dislikes } = tally.get(m.tmdbId) ?? { likes: 0, maybes: 0, dislikes: 0 };
      return {
        movie: m,
        likes,
        maybes,
        dislikes,
        unanimous: n > 0 && likes === n,
        acceptable: n > 0 && dislikes === 0 && likes + maybes === n,
        score: likes * 2 + maybes,
      };
    })
    .filter((r) => r.likes + r.maybes > 0)
    .sort(
      (a, b) =>
        Number(b.unanimous) - Number(a.unanimous) ||
        Number(b.acceptable) - Number(a.acceptable) ||
        b.score - a.score ||
        a.dislikes - b.dislikes ||
        (b.movie.voteAverage ?? -1) - (a.movie.voteAverage ?? -1) ||
        a.movie.position - b.movie.position,
    );
}
