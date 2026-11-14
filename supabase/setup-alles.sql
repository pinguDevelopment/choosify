-- Komplettes Setup in einem Rutsch: im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

-- Film-Aussucher: Grundschema
--
-- Sicherheitsmodell:
--   * Browser greifen NIE direkt auf die Datenbank zu. Alle Lese- und Schreibzugriffe
--     laufen über die Next.js-API mit dem Service-Role-Key (nur auf dem Server).
--   * RLS ist auf allen Tabellen aktiv, ohne Policies für anon/authenticated.
--     Selbst wenn der öffentliche anon-Key bekannt wird, ist nichts lesbar oder schreibbar.
--   * Geheimnisse (Host-, Teilnehmer- und Crew-Tokens) werden nur als SHA-256-Hash gespeichert.

create extension if not exists pgcrypto;

-- Eine Crew ist die feste Gruppe (z.B. "Filmabend Freitag"), der die Abspann-Liste gehört.
create table crews (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 60),
  secret_hash      text not null,
  created_at       timestamptz not null default now()
);

-- "Abspann": Filme, die die Crew schon gesehen hat. Sie werden nicht mehr vorgeschlagen.
create table abspann (
  crew_id          uuid not null references crews(id) on delete cascade,
  tmdb_id          integer not null check (tmdb_id > 0),
  title            text not null check (char_length(title) <= 300),
  poster_path      text check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]+$'),
  release_year     smallint,
  watched_at       timestamptz not null default now(),
  primary key (crew_id, tmdb_id)
);

create type room_status as enum ('lobby', 'voting', 'done');

-- Ein Raum ist eine einzelne Abstimmungsrunde.
create table rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$'),
  crew_id          uuid references crews(id) on delete set null,
  region           text not null default 'DE' check (region ~ '^[A-Z]{2}$'),
  provider_ids     integer[] not null default '{}' check (cardinality(provider_ids) <= 30),
  status           room_status not null default 'lobby',
  winner_tmdb_id   integer,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours'
);

create table participants (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references rooms(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 30),
  token_hash       text not null unique,
  is_host          boolean not null default false,
  genre_ids        integer[] not null default '{}' check (cardinality(genre_ids) <= 20),
  genres_done      boolean not null default false,
  joined_at        timestamptz not null default now()
);
create index participants_room_idx on participants(room_id);
-- Genau ein Host pro Raum.
create unique index participants_one_host on participants(room_id) where is_host;
-- Namen pro Raum eindeutig (ohne Groß-/Kleinschreibung).
create unique index participants_unique_name on participants(room_id, lower(name));

-- Kandidaten, die in diesem Raum geswipt werden (aus TMDB zwischengespeichert).
create table room_movies (
  room_id          uuid not null references rooms(id) on delete cascade,
  tmdb_id          integer not null check (tmdb_id > 0),
  position         integer not null,
  title            text not null check (char_length(title) <= 300),
  overview         text check (char_length(overview) <= 2000),
  poster_path      text check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]+$'),
  release_year     smallint,
  vote_average     numeric(3,1),
  runtime_min      smallint,
  genre_ids        integer[] not null default '{}',
  primary key (room_id, tmdb_id)
);

create table votes (
  room_id          uuid not null,
  participant_id   uuid not null references participants(id) on delete cascade,
  tmdb_id          integer not null,
  liked            boolean not null,
  voted_at         timestamptz not null default now(),
  primary key (participant_id, tmdb_id),
  foreign key (room_id, tmdb_id) references room_movies(room_id, tmdb_id) on delete cascade
);
create index votes_room_idx on votes(room_id);

-- Rangliste: zuerst Filme, die ALLE wollen, dann nach Anzahl Zusagen, dann TMDB-Bewertung.
create or replace function room_ranking(p_room_id uuid)
returns table (
  tmdb_id integer,
  title text,
  poster_path text,
  release_year smallint,
  vote_average numeric,
  likes integer,
  dislikes integer,
  participants integer,
  unanimous boolean
)
language sql stable
set search_path = public
as $$
  with p as (
    select count(*)::int as n from participants where room_id = p_room_id
  )
  select m.tmdb_id, m.title, m.poster_path, m.release_year, m.vote_average,
         coalesce(sum(case when v.liked then 1 else 0 end), 0)::int as likes,
         coalesce(sum(case when v.liked then 0 else 1 end), 0)::int as dislikes,
         p.n as participants,
         (p.n > 0 and coalesce(sum(case when v.liked then 1 else 0 end), 0) = p.n) as unanimous
  from room_movies m
  cross join p
  left join votes v on v.room_id = m.room_id and v.tmdb_id = m.tmdb_id
  where m.room_id = p_room_id
  group by m.tmdb_id, m.title, m.poster_path, m.release_year, m.vote_average, p.n
  having coalesce(sum(case when v.liked then 1 else 0 end), 0) > 0
  order by unanimous desc, likes desc, dislikes asc, m.vote_average desc nulls last
$$;

-- Abgelaufene Räume aufräumen (per Cron oder manuell aufrufbar).
create or replace function cleanup_expired_rooms()
returns integer
language sql
set search_path = public
as $$
  with d as (delete from rooms where expires_at < now() returning 1)
  select count(*)::int from d
$$;

-- RLS: alles zu für Client-Rollen. Nur der Service-Role-Key (Server) kommt durch.
alter table crews        enable row level security;
alter table abspann      enable row level security;
alter table rooms        enable row level security;
alter table participants enable row level security;
alter table room_movies  enable row level security;
alter table votes        enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

-- Security-Härtung (Schritt 4)

-- Rate Limiting über alle Server-Instanzen hinweg (Token-Bucket in Postgres).
create table rate_limits (
  key        text primary key check (char_length(key) <= 200),
  tokens     double precision not null,
  updated_at timestamptz not null default now()
);
alter table rate_limits enable row level security;

-- true = Anfrage erlaubt. Atomar dank Zeilensperre (FOR UPDATE über upsert).
create or replace function rate_hit(p_key text, p_per_minute integer, p_burst integer)
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

-- Abspann pro Crew begrenzen (Missbrauchsschutz).
create or replace function abspann_limit() returns trigger
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
create trigger abspann_limit before insert on abspann
  for each row execute function abspann_limit();

-- Aufräumen: abgelaufene Räume und alte Rate-Limit-Einträge.
create or replace function cleanup_expired_rooms()
returns integer
language sql
set search_path = public
as $$
  with d as (delete from rooms where expires_at < now() returning 1),
       r as (delete from rate_limits where updated_at < now() - interval '1 hour' returning 1)
  select (select count(*) from d)::int
$$;

-- Stündlich aufräumen, falls pg_cron verfügbar ist (in Supabase: Database -> Extensions -> pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('choosify-cleanup', '17 * * * *', 'select public.cleanup_expired_rooms()');
  end if;
exception when others then
  raise notice 'pg_cron nicht eingerichtet: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

-- Dritte Stimme "Wäre ok": votes.liked (bool) wird zu votes.choice (1 = Ja, 0 = Wäre ok, -1 = Nein).

alter table votes add column if not exists choice smallint;
update votes set choice = case when liked then 1 else -1 end where choice is null;
alter table votes alter column choice set not null;
alter table votes drop constraint if exists votes_choice_check;
alter table votes add constraint votes_choice_check check (choice in (-1, 0, 1));
alter table votes drop column if exists liked;

-- Rangliste:
--   1. alle haben Ja gesagt
--   2. niemand hat Nein gesagt und alle haben abgestimmt (alle wären dabei)
--   3. Punkte: Ja = 2, Wäre ok = 1
--   4. weniger Neins, dann TMDB-Bewertung
drop function if exists room_ranking(uuid);
create function room_ranking(p_room_id uuid)
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Stichwahl: Liegen am Ende mehrere Filme gleichauf vorne, wählt jede Person genau einen davon.
-- Danach gibt es immer genau einen Gewinner.

alter type room_status add value if not exists 'runoff';

alter table rooms add column if not exists runoff_ids integer[];
alter table rooms add column if not exists winner_to_abspann boolean not null default false;

create table if not exists runoff_votes (
  room_id          uuid not null,
  participant_id   uuid not null references participants(id) on delete cascade,
  tmdb_id          integer not null,
  voted_at         timestamptz not null default now(),
  primary key (room_id, participant_id),
  foreign key (room_id, tmdb_id) references room_movies(room_id, tmdb_id) on delete cascade
);
alter table runoff_votes enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Host-Option "Sonstige / eigene Quelle": Filme werden vorgeschlagen, auch wenn sie bei
-- keinem gewählten Dienst im Abo laufen (z. B. eigene Sammlung, Leihen, Mediathek).
alter table rooms add column if not exists any_source boolean not null default false;

notify pgrst, 'reload schema';

-- Optionales Konto per Magic-Link (Supabase Auth, E-Mail).
-- Supabase Auth prüft nur, dass die E-Mail-Adresse dem Nutzer gehört. Danach
-- legt unser Server eine eigene Sitzung an (256-Bit-Token im httpOnly-Cookie,
-- in der Datenbank nur der HMAC), genau wie bei Teilnehmern und Crews.
-- Gäste brauchen weiterhin kein Konto.

create table if not exists accounts (
  id                     uuid primary key,  -- = auth.users.id
  email                  text not null check (char_length(email) between 3 and 320),
  favorite_provider_ids  integer[] not null default '{}' check (cardinality(favorite_provider_ids) <= 60),
  favorite_other         boolean not null default false,
  created_at             timestamptz not null default now()
);

create table if not exists account_sessions (
  token_hash   text primary key,
  account_id   uuid not null references accounts(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '180 days'
);
create index if not exists account_sessions_account_idx on account_sessions(account_id);

-- Crews können einem Konto gehören. Ohne Konto bleibt alles wie bisher (Crew-Cookie).
alter table crews add column if not exists account_id uuid references accounts(id) on delete set null;
alter table crews add column if not exists last_used_at timestamptz not null default now();
create index if not exists crews_account_idx on crews(account_id);

alter table accounts         enable row level security;
alter table account_sessions enable row level security;

-- Wird ein Nutzer in Supabase Auth gelöscht, verschwindet auch sein Konto
-- (Crews bleiben erhalten und fallen an die Geräte mit Crew-Cookie zurück).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users')
     and not exists (select 1 from pg_constraint where conname = 'accounts_id_auth_fkey') then
    alter table accounts add constraint accounts_id_auth_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Aufräumen: zusätzlich abgelaufene Konto-Sitzungen löschen.
create or replace function cleanup_expired_rooms()
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

notify pgrst, 'reload schema';
