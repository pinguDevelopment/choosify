import type { ColumnType } from "kysely";

// Tabellen, wie der Code sie sieht (nach der Vereinheitlichung in db.ts):
// Listen sind Arrays, Wahrheitswerte booleans, Zeitstempel ISO-Strings in UTC.

/** Zeitstempel mit Standardwert in der Datenbank (beim Einfügen optional). */
type Timestamp = ColumnType<string, string | undefined, string>;
type List<T> = ColumnType<T[], T[] | undefined, T[]>;
type Flag = ColumnType<boolean, boolean | undefined, boolean>;

export type RoomStatus = "lobby" | "voting" | "runoff" | "done";

export interface DB {
  crews: {
    id: string;
    name: string;
    secret_hash: string;
    account_id: string | null;
    created_at: Timestamp;
    last_used_at: Timestamp;
  };
  abspann: {
    crew_id: string;
    tmdb_id: number;
    title: string;
    title_en: string | null;
    poster_path: string | null;
    release_year: number | null;
    watched_at: Timestamp;
    genre_ids: List<number>;
    tags: List<string>;
  };
  rooms: {
    id: string;
    code: string;
    crew_id: string | null;
    region: string;
    provider_ids: List<number>;
    status: ColumnType<RoomStatus, RoomStatus | undefined, RoomStatus>;
    winner_tmdb_id: number | null;
    runoff_ids: number[] | null;
    winner_to_abspann: Flag;
    any_source: Flag;
    year_from: number | null;
    year_to: number | null;
    created_at: Timestamp;
    expires_at: Timestamp;
  };
  participants: {
    id: string;
    room_id: string;
    name: string;
    token_hash: string;
    is_host: Flag;
    genre_ids: List<number>;
    genres_done: Flag;
    joined_at: Timestamp;
  };
  room_movies: {
    room_id: string;
    tmdb_id: number;
    position: number;
    title: string;
    overview: string | null;
    title_en: string | null;
    overview_en: string | null;
    poster_path: string | null;
    release_year: number | null;
    vote_average: number | null;
    runtime_min: number | null;
    genre_ids: List<number>;
    tags: List<string>;
  };
  votes: {
    room_id: string;
    participant_id: string;
    tmdb_id: number;
    /** 1 = ja, 0 = wäre ok, -1 = nein */
    choice: number;
    voted_at: Timestamp;
  };
  runoff_votes: {
    room_id: string;
    participant_id: string;
    tmdb_id: number;
    voted_at: Timestamp;
  };
  rate_limits: {
    key: string;
    tokens: number;
    updated_at: Timestamp;
  };
  accounts: {
    id: string;
    email: string;
    favorite_provider_ids: List<number>;
    favorite_other: Flag;
    created_at: Timestamp;
  };
  account_sessions: {
    token_hash: string;
    account_id: string;
    created_at: Timestamp;
    expires_at: string;
  };
  ratings: {
    crew_id: string;
    tmdb_id: number;
    rater_hash: string;
    name: string;
    stars: number;
    rated_at: Timestamp;
  };
  tv_pairings: {
    id: string;
    code: string;
    secret_hash: string;
    room_id: string | null;
    linked_at: string | null;
    created_at: Timestamp;
    expires_at: string;
  };
}
