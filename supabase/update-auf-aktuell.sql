-- Filmabend: bringt eine bestehende Datenbank auf den aktuellen Stand (Stand 15.11., mit Konten, Bewertungen und Fernseher-Link).
-- Darf beliebig oft ausgeführt werden, egal welche Updates schon gelaufen sind.
-- Im Supabase-Dashboard unter "SQL Editor" komplett einfügen und auf "Run" klicken.
-- Ganz unten steht eine Prüfung: Sie listet alles, was noch fehlt (leeres Ergebnis = alles da).

-- 1) Drei Stimmen: votes.liked (bool) -> votes.choice (1 = Ja, 0 = Wäre ok, -1 = Nein)
alter table votes add column if not exists choice smallint;
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'votes' and column_name = 'liked') then
    execute 'update votes set choice = case when liked then 1 else -1 end where choice is null';
    execute 'alter table votes drop column liked';
  end if;
end $$;
delete from votes where choice is null;
alter table votes alter column choice set not null;
alter table votes drop constraint if exists votes_choice_check;
alter table votes add constraint votes_choice_check check (choice in (-1, 0, 1));

-- 2) Stichwahl bei Gleichstand
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

-- 3) Option "Sonstige / eigene Quelle"
alter table rooms add column if not exists any_source boolean not null default false;

-- 3b) Stimmungs-Tags auf den Abstimmkarten
alter table room_movies add column if not exists tags text[] not null default '{}';
alter table room_movies drop constraint if exists room_movies_tags_check;
alter table room_movies add constraint room_movies_tags_check check (cardinality(tags) <= 6);

-- 4) Rangliste neu anlegen
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

-- 5) Konten per Magic-Link (optional für Hosts)
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

-- 5b) Bewertungen im Abspann (Sterne pro Person) und Genres/Tags der gesehenen Filme
-- Genres und Tags der gesehenen Filme, damit der Geschmack ohne TMDB-Abruf berechnet werden kann.
alter table abspann add column if not exists genre_ids integer[] not null default '{}';
alter table abspann add column if not exists tags text[] not null default '{}';
alter table abspann drop constraint if exists abspann_genre_ids_check;
alter table abspann add constraint abspann_genre_ids_check check (cardinality(genre_ids) <= 20);
alter table abspann drop constraint if exists abspann_tags_check;
alter table abspann add constraint abspann_tags_check check (cardinality(tags) <= 6);

-- Ältere Einträge: Genres und Tags aus noch vorhandenen Runden der Crew übernehmen.
update abspann a
set genre_ids = m.genre_ids, tags = m.tags
from rooms r
join room_movies m on m.room_id = r.id
where r.crew_id = a.crew_id and m.tmdb_id = a.tmdb_id and a.genre_ids = '{}';

create table if not exists ratings (
  crew_id      uuid not null,
  tmdb_id      integer not null,
  rater_hash   text not null check (char_length(rater_hash) = 64),
  name         text not null check (char_length(name) between 1 and 30),
  stars        smallint not null check (stars between 1 and 5),
  rated_at     timestamptz not null default now(),
  primary key (crew_id, tmdb_id, rater_hash),
  -- Fliegt der Film aus dem Abspann, verschwinden auch seine Bewertungen.
  foreign key (crew_id, tmdb_id) references abspann(crew_id, tmdb_id) on delete cascade
);
-- Pro Film jeder Name nur einmal (ohne Groß-/Kleinschreibung).
create unique index if not exists ratings_unique_name on ratings(crew_id, tmdb_id, lower(name));

alter table ratings enable row level security;

-- Missbrauchsschutz: höchstens 30 Bewertungen pro Film (wie Personen pro Runde).
create or replace function ratings_limit() returns trigger
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
drop trigger if exists ratings_limit on ratings;
create trigger ratings_limit before insert on ratings
  for each row execute function ratings_limit();

-- 5c) Fernseher-Link pro Crew (Home Assistant / Fernseh-Ansicht)
create table if not exists crew_tv (
  crew_id        uuid primary key references crews(id) on delete cascade,
  version        integer not null default 1 check (version between 1 and 1000000),
  provider_ids   integer[] not null default '{}' check (cardinality(provider_ids) <= 30),
  any_source     boolean not null default false,
  -- Letzte Runde vom Fernseher: Wird der Link erneut geöffnet, solange sie noch in der Lobby ist,
  -- zeigt er dieselbe Runde statt einer neuen.
  last_room_id   uuid references rooms(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table crew_tv enable row level security;

-- 6) Browser-Rollen haben weiterhin keinen Zugriff (alles läuft über den Server)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

-- 7) PostgREST soll das neue Schema sofort kennen
notify pgrst, 'reload schema';

-- 8) Prüfung: listet, was noch fehlt. Leeres Ergebnis = alles in Ordnung.
select fehlt from (
  select 'Spalte ' || t || '.' || c as fehlt
  from (values ('votes','choice'), ('rooms','runoff_ids'), ('rooms','winner_to_abspann'),
               ('rooms','any_source'), ('runoff_votes','tmdb_id'),
               ('accounts','favorite_provider_ids'), ('account_sessions','token_hash'),
               ('crews','account_id'), ('crews','last_used_at'), ('room_movies','tags'),
               ('abspann','genre_ids'), ('abspann','tags'), ('ratings','stars'),
               ('crew_tv','provider_ids'), ('crew_tv','last_room_id')) need(t, c)
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = need.t and column_name = need.c)
  union all
  select 'Alte Spalte votes.liked ist noch da'
  where exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'votes' and column_name = 'liked')
  union all
  select 'Funktion ' || f
  from (values ('room_ranking'), ('rate_hit'), ('ratings_limit')) need(f)
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = need.f)
  union all
  select 'Rangliste ohne Spalte "acceptable" (alte Version)'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'room_ranking'
                      and pg_get_function_result(p.oid) like '%acceptable%')
  union all
  select 'Status "runoff" fehlt im Typ room_status'
  where not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                    where t.typname = 'room_status' and e.enumlabel = 'runoff')
) x;
