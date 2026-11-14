// Spiegel der Server-Antwort von GET /api/rooms/[code]
export type Movie = {
  tmdbId: number;
  title: string;
  overview: string | null;
  poster: string | null;
  year: number | null;
  rating: number | null;
  genreIds: number[];
};

export type RankingRow = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
  likes: number;
  dislikes: number;
  unanimous: boolean;
};

export type RoomState = {
  code: string;
  status: "lobby" | "voting" | "done";
  region: string;
  providerIds: number[];
  me: { name: string; isHost: boolean; genresDone: boolean; genreIds: number[] } | null;
  participants: { name: string; isHost: boolean; genresDone: boolean; voted: number }[];
  movies: Movie[];
  myVotes: Record<number, boolean>;
  ranking: RankingRow[];
  winner: number | null;
};
