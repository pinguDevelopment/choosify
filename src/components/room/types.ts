// Spiegel der Server-Antwort von GET /api/rooms/[code]
export type Choice = "yes" | "maybe" | "no";

export type Movie = {
  tmdbId: number;
  title: string;
  overview: string | null;
  poster: string | null;
  year: number | null;
  rating: number | null;
  genreIds: number[];
  /** deutsche Genre-Namen, wichtigstes zuerst */
  genres: string[];
  /** 2 bis 4 Stimmungs-Tags ohne "#", z. B. "lustig", "zeitreise" */
  tags: string[];
  /** Laufzeit in Minuten, falls bekannt */
  runtime: number | null;
};

export type RankingRow = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
  likes: number;
  maybes: number;
  dislikes: number;
  unanimous: boolean;
  /** niemand ist dagegen und alle haben Ja oder Wäre ok gesagt */
  acceptable: boolean;
};

export type RoomState = {
  code: string;
  status: "lobby" | "voting" | "runoff" | "done";
  region: string;
  providerIds: number[];
  me: { name: string; isHost: boolean; genresDone: boolean; genreIds: number[] } | null;
  participants: { name: string; isHost: boolean; genresDone: boolean; voted: number }[];
  movies: Movie[];
  myVotes: Record<number, Choice>;
  ranking: RankingRow[];
  /** Stichwahl bei Gleichstand; tally gibt es erst nach dem Ende */
  runoff: {
    tmdbIds: number[];
    myPick: number | null;
    votes: number;
    tally: Record<number, number> | null;
    decidedByRating: boolean;
  } | null;
  winner: number | null;
  /** Bewertungslink für den Gewinner, sobald er im Abspann steht */
  rateToken: string | null;
};
