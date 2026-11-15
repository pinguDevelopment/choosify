import "server-only";
import { sql, type Kysely } from "kysely";
import type { DB } from "./db-types";

// Tabellen für MariaDB/MySQL und SQLite. Die App legt sie beim ersten Zugriff selbst an,
// beim Self-Hosten muss also niemand SQL ausführen. Für Supabase/Postgres gelten weiterhin
// die Dateien in supabase/ (setup-alles.sql bzw. update-auf-aktuell.sql).
//
// Spätere Änderungen am Schema kommen als neue Einträge ans Ende von MIGRATIONS,
// die Tabelle cinemood_schema merkt sich, was schon gelaufen ist.

const SQLITE_NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const SQLITE: string[][] = [
  [
    `create table if not exists accounts (
      id text primary key,
      email text not null,
      favorite_provider_ids text not null default '[]',
      favorite_other integer not null default 0,
      created_at text not null default ${SQLITE_NOW}
    )`,
    `create table if not exists account_sessions (
      token_hash text primary key,
      account_id text not null references accounts(id) on delete cascade,
      created_at text not null default ${SQLITE_NOW},
      expires_at text not null
    )`,
    `create index if not exists account_sessions_account_idx on account_sessions(account_id)`,
    `create table if not exists crews (
      id text primary key,
      name text not null check (length(name) between 1 and 60),
      secret_hash text not null,
      account_id text references accounts(id) on delete set null,
      created_at text not null default ${SQLITE_NOW},
      last_used_at text not null default ${SQLITE_NOW}
    )`,
    `create index if not exists crews_account_idx on crews(account_id)`,
    `create table if not exists abspann (
      crew_id text not null references crews(id) on delete cascade,
      tmdb_id integer not null check (tmdb_id > 0),
      title text not null,
      title_en text,
      poster_path text,
      release_year integer,
      watched_at text not null default ${SQLITE_NOW},
      genre_ids text not null default '[]',
      tags text not null default '[]',
      primary key (crew_id, tmdb_id)
    )`,
    `create table if not exists rooms (
      id text primary key,
      code text not null unique,
      crew_id text references crews(id) on delete set null,
      region text not null default 'DE',
      provider_ids text not null default '[]',
      status text not null default 'lobby' check (status in ('lobby', 'voting', 'runoff', 'done')),
      winner_tmdb_id integer,
      runoff_ids text,
      winner_to_abspann integer not null default 0,
      any_source integer not null default 0,
      year_from integer,
      year_to integer,
      created_at text not null default ${SQLITE_NOW},
      expires_at text not null
    )`,
    `create index if not exists rooms_expires_idx on rooms(expires_at)`,
    `create table if not exists participants (
      id text primary key,
      room_id text not null references rooms(id) on delete cascade,
      name text not null check (length(name) between 1 and 30),
      token_hash text not null unique,
      is_host integer not null default 0,
      genre_ids text not null default '[]',
      genres_done integer not null default 0,
      joined_at text not null default ${SQLITE_NOW}
    )`,
    `create index if not exists participants_room_idx on participants(room_id)`,
    `create unique index if not exists participants_one_host on participants(room_id) where is_host = 1`,
    `create unique index if not exists participants_unique_name on participants(room_id, lower(name))`,
    `create table if not exists room_movies (
      room_id text not null references rooms(id) on delete cascade,
      tmdb_id integer not null check (tmdb_id > 0),
      position integer not null,
      title text not null,
      overview text,
      title_en text,
      overview_en text,
      poster_path text,
      release_year integer,
      vote_average real,
      runtime_min integer,
      genre_ids text not null default '[]',
      tags text not null default '[]',
      primary key (room_id, tmdb_id)
    )`,
    `create table if not exists votes (
      room_id text not null,
      participant_id text not null references participants(id) on delete cascade,
      tmdb_id integer not null,
      choice integer not null check (choice in (-1, 0, 1)),
      voted_at text not null default ${SQLITE_NOW},
      primary key (participant_id, tmdb_id),
      foreign key (room_id, tmdb_id) references room_movies(room_id, tmdb_id) on delete cascade
    )`,
    `create index if not exists votes_room_idx on votes(room_id)`,
    `create table if not exists runoff_votes (
      room_id text not null,
      participant_id text not null references participants(id) on delete cascade,
      tmdb_id integer not null,
      voted_at text not null default ${SQLITE_NOW},
      primary key (room_id, participant_id),
      foreign key (room_id, tmdb_id) references room_movies(room_id, tmdb_id) on delete cascade
    )`,
    `create table if not exists rate_limits (
      key text primary key,
      tokens real not null,
      updated_at text not null default ${SQLITE_NOW}
    )`,
    `create table if not exists ratings (
      crew_id text not null,
      tmdb_id integer not null,
      rater_hash text not null,
      name text not null,
      stars integer not null check (stars between 1 and 5),
      rated_at text not null default ${SQLITE_NOW},
      primary key (crew_id, tmdb_id, rater_hash),
      foreign key (crew_id, tmdb_id) references abspann(crew_id, tmdb_id) on delete cascade
    )`,
    `create unique index if not exists ratings_unique_name on ratings(crew_id, tmdb_id, lower(name))`,
    `create table if not exists tv_pairings (
      id text primary key,
      code text not null unique,
      secret_hash text not null unique,
      room_id text references rooms(id) on delete cascade,
      linked_at text,
      created_at text not null default ${SQLITE_NOW},
      expires_at text not null
    )`,
    `create index if not exists tv_pairings_expires_idx on tv_pairings(expires_at)`,
  ],
];

// MariaDB/MySQL: Namen in Unique-Indizes ohne Unterscheidung von Groß/Klein über die Sortierung (_ci).
// "Nur ein Host pro Runde" gibt es dort ohne Teil-Index, das prüft joinRoom nach dem Einfügen.
const MYSQL_NOW = "current_timestamp(3)";
const T = "engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci";

const MYSQL: string[][] = [
  [
    `create table if not exists accounts (
      id char(36) primary key,
      email varchar(320) not null,
      favorite_provider_ids varchar(1000) not null default '[]',
      favorite_other boolean not null default false,
      created_at datetime(3) not null default ${MYSQL_NOW}
    ) ${T}`,
    `create table if not exists account_sessions (
      token_hash char(64) primary key,
      account_id char(36) not null,
      created_at datetime(3) not null default ${MYSQL_NOW},
      expires_at datetime(3) not null,
      index account_sessions_account_idx (account_id),
      foreign key (account_id) references accounts(id) on delete cascade
    ) ${T}`,
    `create table if not exists crews (
      id char(36) primary key,
      name varchar(60) not null,
      secret_hash char(64) not null,
      account_id char(36),
      created_at datetime(3) not null default ${MYSQL_NOW},
      last_used_at datetime(3) not null default ${MYSQL_NOW},
      index crews_account_idx (account_id),
      foreign key (account_id) references accounts(id) on delete set null
    ) ${T}`,
    `create table if not exists abspann (
      crew_id char(36) not null,
      tmdb_id int not null,
      title varchar(300) not null,
      title_en varchar(300),
      poster_path varchar(200),
      release_year smallint,
      watched_at datetime(3) not null default ${MYSQL_NOW},
      genre_ids varchar(500) not null default '[]',
      tags varchar(500) not null default '[]',
      primary key (crew_id, tmdb_id),
      foreign key (crew_id) references crews(id) on delete cascade
    ) ${T}`,
    `create table if not exists rooms (
      id char(36) primary key,
      code varchar(10) not null unique,
      crew_id char(36),
      region char(2) not null default 'DE',
      provider_ids varchar(1000) not null default '[]',
      status varchar(10) not null default 'lobby',
      winner_tmdb_id int,
      runoff_ids varchar(500),
      winner_to_abspann boolean not null default false,
      any_source boolean not null default false,
      year_from smallint,
      year_to smallint,
      created_at datetime(3) not null default ${MYSQL_NOW},
      expires_at datetime(3) not null,
      index rooms_expires_idx (expires_at),
      foreign key (crew_id) references crews(id) on delete set null
    ) ${T}`,
    `create table if not exists participants (
      id char(36) primary key,
      room_id char(36) not null,
      name varchar(30) not null,
      token_hash char(64) not null unique,
      is_host boolean not null default false,
      genre_ids varchar(500) not null default '[]',
      genres_done boolean not null default false,
      joined_at datetime(3) not null default ${MYSQL_NOW},
      unique key participants_unique_name (room_id, name),
      foreign key (room_id) references rooms(id) on delete cascade
    ) ${T}`,
    `create table if not exists room_movies (
      room_id char(36) not null,
      tmdb_id int not null,
      position int not null,
      title varchar(300) not null,
      overview text,
      title_en varchar(300),
      overview_en text,
      poster_path varchar(200),
      release_year smallint,
      vote_average decimal(3,1),
      runtime_min smallint,
      genre_ids varchar(500) not null default '[]',
      tags varchar(500) not null default '[]',
      primary key (room_id, tmdb_id),
      foreign key (room_id) references rooms(id) on delete cascade
    ) ${T}`,
    `create table if not exists votes (
      room_id char(36) not null,
      participant_id char(36) not null,
      tmdb_id int not null,
      choice smallint not null,
      voted_at datetime(3) not null default ${MYSQL_NOW},
      primary key (participant_id, tmdb_id),
      index votes_room_idx (room_id),
      foreign key (participant_id) references participants(id) on delete cascade,
      foreign key (room_id, tmdb_id) references room_movies(room_id, tmdb_id) on delete cascade
    ) ${T}`,
    `create table if not exists runoff_votes (
      room_id char(36) not null,
      participant_id char(36) not null,
      tmdb_id int not null,
      voted_at datetime(3) not null default ${MYSQL_NOW},
      primary key (room_id, participant_id),
      foreign key (participant_id) references participants(id) on delete cascade,
      foreign key (room_id, tmdb_id) references room_movies(room_id, tmdb_id) on delete cascade
    ) ${T}`,
    `create table if not exists rate_limits (
      \`key\` varchar(200) primary key,
      tokens double not null,
      updated_at datetime(3) not null default ${MYSQL_NOW}
    ) ${T}`,
    `create table if not exists ratings (
      crew_id char(36) not null,
      tmdb_id int not null,
      rater_hash char(64) not null,
      name varchar(30) not null,
      stars smallint not null,
      rated_at datetime(3) not null default ${MYSQL_NOW},
      primary key (crew_id, tmdb_id, rater_hash),
      unique key ratings_unique_name (crew_id, tmdb_id, name),
      foreign key (crew_id, tmdb_id) references abspann(crew_id, tmdb_id) on delete cascade
    ) ${T}`,
    `create table if not exists tv_pairings (
      id char(36) primary key,
      code char(6) not null unique,
      secret_hash char(64) not null unique,
      room_id char(36),
      linked_at datetime(3),
      created_at datetime(3) not null default ${MYSQL_NOW},
      expires_at datetime(3) not null,
      index tv_pairings_expires_idx (expires_at),
      foreign key (room_id) references rooms(id) on delete cascade
    ) ${T}`,
  ],
];

export async function ensureSchema(db: Kysely<DB>, dialect: "mysql" | "sqlite"): Promise<void> {
  const migrations = dialect === "mysql" ? MYSQL : SQLITE;
  await sql`create table if not exists cinemood_schema (version integer not null)`.execute(db);
  const row = await sql<{ v: number | null }>`select max(version) as v from cinemood_schema`.execute(db);
  const done = Number(row.rows[0]?.v ?? 0);
  for (let i = done; i < migrations.length; i++) {
    for (const stmt of migrations[i]) await sql.raw(stmt).execute(db);
    await sql`insert into cinemood_schema (version) values (${i + 1})`.execute(db);
  }
}
