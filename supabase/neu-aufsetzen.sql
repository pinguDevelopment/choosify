-- =====================================================================================
--  CINEMOOD: DATENBANK KOMPLETT NEU AUFSETZEN
-- =====================================================================================
--
--  !!! ACHTUNG: DIESE DATEI LÖSCHT ALLE DATEN VON CINEMOOD !!!
--
--  Gelöscht werden unwiderruflich:
--    * alle Runden mit Teilnehmern, Stimmen und Stichwahlen
--    * alle Konten-Daten in Cinemood (Favoriten, Sitzungen, „Train my Algorithm“)
--    * alle Watchlists (Crews) mit Filmen, Bewertungen, Mitgliedern und Einladungen
--    * alle gekoppelten Fernseher und Rate-Limit-Einträge
--
--  Danach ist die Datenbank leer und auf dem aktuellen Stand (inkl. Training und
--  gemeinsamer Watchlist). Alle angemeldeten Geräte sind abgemeldet.
--
--  NICHT angefasst werden die Supabase-eigenen Bereiche (auth, storage usw.).
--  Die Logins in Supabase Auth bleiben also bestehen: Wer sich wieder anmeldet,
--  bekommt automatisch ein neues, leeres Cinemood-Konto.
--
--  Ausführen: Supabase-Dashboard -> SQL Editor -> alles einfügen -> Run.
--  Die Datei kann beliebig oft ausgeführt werden. Läuft etwas schief, wird nichts
--  geändert (alles passiert in einer Transaktion).
--
--  Wer nur auf den neuen Stand aktualisieren und die Daten BEHALTEN will, nimmt
--  stattdessen supabase/update-auf-aktuell.sql.
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- 1. Alles von Cinemood löschen (nur im Schema public)
-- -------------------------------------------------------------------------------------

-- Stündliches Aufräumen (pg_cron) abmelden, falls eingerichtet.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'choosify-cleanup';
  end if;
exception when others then
  raise notice 'pg_cron-Job nicht entfernt: %', sqlerrm;
end $$;

drop table if exists
  public.crew_members,
  public.training_votes,
  public.tv_pairings,
  public.ratings,
  public.runoff_votes,
  public.votes,
  public.room_movies,
  public.participants,
  public.rooms,
  public.abspann,
  public.crew_tv,          -- alte Tabelle (Fernseher-Link), gibt es nicht mehr
  public.account_sessions,
  public.crews,
  public.accounts,
  public.rate_limits
cascade;

drop function if exists public.room_ranking(uuid) cascade;
drop function if exists public.cleanup_expired_rooms() cascade;
drop function if exists public.rate_hit(text, integer, integer) cascade;
drop function if exists public.abspann_limit() cascade;
drop function if exists public.ratings_limit() cascade;

drop type if exists public.room_status cascade;

-- -------------------------------------------------------------------------------------
-- 2. Neu anlegen (aktueller Stand)
-- -------------------------------------------------------------------------------------
--
-- Sicherheitsmodell:
--   * Browser greifen NIE direkt auf die Datenbank zu. Alle Lese- und Schreibzugriffe
--     laufen über die Next.js-API (nur auf dem Server).
--   * RLS ist auf allen Tabellen aktiv, ohne Policies für anon/authenticated.
--     Selbst wenn der öffentliche anon-Key bekannt wird, ist nichts lesbar oder schreibbar.
--   * Geheimnisse (Tokens, Links) werden nur als Hash/HMAC gespeichert.

create extension if not exists pgcrypto;

-- Konten (optional, Login über Supabase Auth). id = auth.users.id
create table public.accounts (
  id                     uuid primary key,
  email                  text not null check (char_length(email) between 3 and 320),
  favorite_provider_ids  integer[] not null default '{}' check (cardinality(favorite_provider_ids) <= 60),
  favorite_other         boolean not null default false,
  created_at             timestamptz not null default now(),
  -- trainierten Geschmack in Gruppenrunden nutzen
  use_training           boolean not null default true
);

create table public.account_sessions (
  token_hash   text primary key,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '180 days'
);
create index account_sessions_account_idx on public.account_sessions(account_id);

-- Wird ein Nutzer in Supabase Auth gelöscht, verschwindet auch sein Konto.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    alter table public.accounts add constraint accounts_id_auth_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Crew = Watchlist (feste Gruppe). Besitzer steht in account_id, weitere Mitglieder in crew_members.
create table public.crews (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 60),
  secret_hash        text not null,
  created_at         timestamptz not null default now(),
  account_id         uuid references public.accounts(id) on delete set null,
  last_used_at       timestamptz not null default now(),
  -- Einladungslink (nur HMAC), läuft nach 7 Tagen ab
  invite_hash        text check (char_length(invite_hash) = 64),
  invite_expires_at  timestamptz
);
create index crews_account_idx on public.crews(account_id);
create unique index crews_invite_hash_idx on public.crews (invite_hash);

create table public.crew_members (
  crew_id     uuid not null references public.crews(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (crew_id, account_id)
);
create index crew_members_account_idx on public.crew_members (account_id);

-- Watchlist-Filme (intern „abspann“). Werden nicht mehr vorgeschlagen.
create table public.abspann (
  crew_id       uuid not null references public.crews(id) on delete cascade,
  tmdb_id       integer not null check (tmdb_id > 0),
  title         text not null check (char_length(title) <= 300),
  poster_path   text check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]+$'),
  release_year  smallint,
  watched_at    timestamptz not null default now(),
  genre_ids     integer[] not null default '{}' check (cardinality(genre_ids) <= 20),
  tags          text[] not null default '{}' check (cardinality(tags) <= 6),
  title_en      text check (char_length(title_en) <= 300),
  primary key (crew_id, tmdb_id)
);

-- Bewertungen (1 bis 5 Sterne) der Watchlist-Filme, auch ohne Konto per signiertem Link.
create table public.ratings (
  crew_id      uuid not null,
  tmdb_id      integer not null,
  rater_hash   text not null check (char_length(rater_hash) = 64),
  name         text not null check (char_length(name) between 1 and 30),
  stars        smallint not null check (stars between 1 and 5),
  rated_at     timestamptz not null default now(),
  primary key (crew_id, tmdb_id, rater_hash),
  foreign key (crew_id, tmdb_id) references public.abspann(crew_id, tmdb_id) on delete cascade
);
create unique index ratings_unique_name on public.ratings(crew_id, tmdb_id, lower(name));

create type public.room_status as enum ('lobby', 'voting', 'done', 'runoff');

-- Eine Runde (Abstimmung).
create table public.rooms (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$'),
  crew_id            uuid references public.crews(id) on delete set null,
  region             text not null default 'DE' check (region ~ '^[A-Z]{2}$'),
  provider_ids       integer[] not null default '{}' check (cardinality(provider_ids) <= 30),
  status             public.room_status not null default 'lobby',
  winner_tmdb_id     integer,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '24 hours',
  runoff_ids         integer[],
  winner_to_abspann  boolean not null default false,
  any_source         boolean not null default false,
  year_from          smallint,
  year_to            smallint,
  constraint rooms_years_check check (
    (year_from is null or year_from between 1900 and 2100)
    and (year_to is null or year_to between 1900 and 2100)
    and (year_from is null or year_to is null or year_from <= year_to)
  )
);

create table public.participants (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 30),
  token_hash   text not null unique,
  is_host      boolean not null default false,
  genre_ids    integer[] not null default '{}' check (cardinality(genre_ids) <= 20),
  genres_done  boolean not null default false,
  joined_at    timestamptz not null default now(),
  account_id   uuid references public.accounts(id) on delete set null
);
create index participants_room_idx on public.participants(room_id);
create unique index participants_one_host on public.participants(room_id) where is_host;
create unique index participants_unique_name on public.participants(room_id, lower(name));

-- Filme einer Runde (aus TMDB zwischengespeichert).
create table public.room_movies (
  room_id       uuid not null references public.rooms(id) on delete cascade,
  tmdb_id       integer not null check (tmdb_id > 0),
  position      integer not null,
  title         text not null check (char_length(title) <= 300),
  overview      text check (char_length(overview) <= 2000),
  poster_path   text check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]+$'),
  release_year  smallint,
  vote_average  numeric(3,1),
  runtime_min   smallint,
  genre_ids     integer[] not null default '{}',
  tags          text[] not null default '{}' check (cardinality(tags) <= 6),
  title_en      text check (char_length(title_en) <= 300),
  overview_en   text check (char_length(overview_en) <= 2000),
  primary key (room_id, tmdb_id)
);

-- Stimmen: 1 = Ja, 0 = Wäre ok, -1 = Nein
create table public.votes (
  room_id         uuid not null,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  tmdb_id         integer not null,
  voted_at        timestamptz not null default now(),
  choice          smallint not null check (choice in (-1, 0, 1)),
  primary key (participant_id, tmdb_id),
  foreign key (room_id, tmdb_id) references public.room_movies(room_id, tmdb_id) on delete cascade
);
create index votes_room_idx on public.votes(room_id);

-- Stichwahl: jede Person wählt genau einen der gleichauf liegenden Filme.
create table public.runoff_votes (
  room_id         uuid not null,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  tmdb_id         integer not null,
  voted_at        timestamptz not null default now(),
  primary key (room_id, participant_id),
  foreign key (room_id, tmdb_id) references public.room_movies(room_id, tmdb_id) on delete cascade
);

-- Fernseher koppeln (Code auf /tv, Host gibt ihn in der Lobby ein).
create table public.tv_pairings (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  secret_hash  text not null unique check (char_length(secret_hash) = 64),
  room_id      uuid references public.rooms(id) on delete cascade,
  linked_at    timestamptz,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index tv_pairings_expires_idx on public.tv_pairings (expires_at);

-- „Train my Algorithm“: Stimmen gehören dem Konto.
create table public.training_votes (
  account_id    uuid not null references public.accounts(id) on delete cascade,
  tmdb_id       integer not null check (tmdb_id > 0),
  choice        smallint not null check (choice in (-1, 0, 1)),
  title         text not null check (char_length(title) between 1 and 300),
  title_en      text check (char_length(title_en) <= 300),
  poster_path   text check (char_length(poster_path) <= 200),
  release_year  smallint,
  genre_ids     integer[] not null default '{}' check (cardinality(genre_ids) <= 20),
  tags          text[] not null default '{}' check (cardinality(tags) <= 6),
  voted_at      timestamptz not null default now(),
  primary key (account_id, tmdb_id)
);
create index training_votes_recent_idx on public.training_votes (account_id, voted_at desc);

-- Rate Limiting über alle Server-Instanzen hinweg (Token-Bucket).
create table public.rate_limits (
  key         text primary key check (char_length(key) <= 200),
  tokens      double precision not null,
  updated_at  timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- Funktionen und Trigger
-- -------------------------------------------------------------------------------------

-- true = Anfrage erlaubt. Atomar dank Zeilensperre über den Upsert.
create function public.rate_hit(p_key text, p_per_minute integer, p_burst integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_tokens double precision;
begin
  insert into rate_limits as r (key, tokens, updated_at)
  values (p_key, p_burst - 1, now())
  on conflict (key) do update
    set tokens = least(p_burst::double precision,
                       r.tokens + extract(epoch from (now() - r.updated_at)) / 60.0 * p_per_minute) - 1,
        updated_at = now()
  returning tokens into v_tokens;

  if v_tokens < 0 then
    -- abgelehnt: Verbrauch nicht anrechnen, damit Dauerfeuer nicht ewig sperrt
    update rate_limits set tokens = 0 where key = p_key;
    return false;
  end if;
  return true;
end
$$;

-- Watchlist pro Crew begrenzen (Missbrauchsschutz).
create function public.abspann_limit() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from abspann where crew_id = new.crew_id) >= 2000 then
    raise exception 'Abspann ist voll' using errcode = 'P0001';
  end if;
  return new;
end
$$;
create trigger abspann_limit before insert on public.abspann
  for each row execute function public.abspann_limit();

-- Höchstens 30 Bewertungen pro Film.
create function public.ratings_limit() returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Eigene Bewertung ändern (Upsert löst ebenfalls diesen Trigger aus) zählt nicht mit.
  if (select count(*) from ratings
      where crew_id = new.crew_id and tmdb_id = new.tmdb_id and rater_hash <> new.rater_hash) >= 30 then
    raise exception 'Zu viele Bewertungen' using errcode = 'P0001';
  end if;
  return new;
end
$$;
create trigger ratings_limit before insert on public.ratings
  for each row execute function public.ratings_limit();

-- Rangliste einer Runde (die App rechnet inzwischen selbst, die Funktion bleibt für Auswertungen).
create function public.room_ranking(p_room_id uuid)
returns table (
  tmdb_id integer,
  title text,
  poster_path text,
  release_year smallint,
  vote_average numeric,
  likes integer,
  maybes integer,
  dislikes integer,
  participants integer,
  unanimous boolean,
  acceptable boolean,
  score integer
)
language sql stable
set search_path = public
as $$
  with p as (
    select count(*)::int as n from participants where room_id = p_room_id
  ), agg as (
    select m.tmdb_id, m.title, m.poster_path, m.release_year, m.vote_average,
           (count(*) filter (where v.choice = 1))::int  as likes,
           (count(*) filter (where v.choice = 0))::int  as maybes,
           (count(*) filter (where v.choice = -1))::int as dislikes
    from room_movies m
    left join votes v on v.room_id = m.room_id and v.tmdb_id = m.tmdb_id
    where m.room_id = p_room_id
    group by m.tmdb_id, m.title, m.poster_path, m.release_year, m.vote_average
  )
  select a.tmdb_id, a.title, a.poster_path, a.release_year, a.vote_average,
         a.likes, a.maybes, a.dislikes, p.n,
         (p.n > 0 and a.likes = p.n) as unanimous,
         (p.n > 0 and a.dislikes = 0 and a.likes + a.maybes = p.n) as acceptable,
         (a.likes * 2 + a.maybes)::int as score
  from agg a cross join p
  where a.likes + a.maybes > 0
  order by unanimous desc, acceptable desc, score desc, a.dislikes asc, a.vote_average desc nulls last
$$;

-- Aufräumen: abgelaufene Runden, alte Rate-Limit-Einträge und Konto-Sitzungen.
create function public.cleanup_expired_rooms()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  delete from rooms where expires_at < now();
  get diagnostics n = row_count;
  delete from rate_limits where updated_at < now() - interval '1 hour';
  delete from account_sessions where expires_at < now();
  return n;
end
$$;

-- -------------------------------------------------------------------------------------
-- Sicherheit: RLS an, Client-Rollen (anon/authenticated) haben keinen Zugriff
-- -------------------------------------------------------------------------------------

alter table public.accounts          enable row level security;
alter table public.account_sessions  enable row level security;
alter table public.crews             enable row level security;
alter table public.crew_members      enable row level security;
alter table public.abspann           enable row level security;
alter table public.ratings           enable row level security;
alter table public.rooms             enable row level security;
alter table public.participants      enable row level security;
alter table public.room_movies       enable row level security;
alter table public.votes             enable row level security;
alter table public.runoff_votes      enable row level security;
alter table public.tv_pairings       enable row level security;
alter table public.training_votes    enable row level security;
alter table public.rate_limits       enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

-- Stündlich aufräumen, falls pg_cron verfügbar ist (Supabase: Database -> Extensions -> pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('choosify-cleanup', '17 * * * *', 'select public.cleanup_expired_rooms()');
  end if;
exception when others then
  raise notice 'pg_cron nicht eingerichtet: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

commit;

-- Fertig. Zur Kontrolle: Diese Abfrage sollte 14 Tabellen mit rls = true zeigen.
select tablename, rowsecurity as rls
from pg_tables
where schemaname = 'public'
  and tablename in ('accounts', 'account_sessions', 'crews', 'crew_members', 'abspann', 'ratings',
                    'rooms', 'participants', 'room_movies', 'votes', 'runoff_votes', 'tv_pairings',
                    'training_votes', 'rate_limits')
order by tablename;
