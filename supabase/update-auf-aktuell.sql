-- Choosify: bringt eine bestehende Datenbank auf den aktuellen Stand (Stand 14.11.).
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

-- 5) Browser-Rollen haben weiterhin keinen Zugriff (alles läuft über den Server)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

-- 6) PostgREST soll das neue Schema sofort kennen
notify pgrst, 'reload schema';

-- 7) Prüfung: listet, was noch fehlt. Leeres Ergebnis = alles in Ordnung.
select fehlt from (
  select 'Spalte ' || t || '.' || c as fehlt
  from (values ('votes','choice'), ('rooms','runoff_ids'), ('rooms','winner_to_abspann'),
               ('rooms','any_source'), ('runoff_votes','tmdb_id')) need(t, c)
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = need.t and column_name = need.c)
  union all
  select 'Alte Spalte votes.liked ist noch da'
  where exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'votes' and column_name = 'liked')
  union all
  select 'Funktion ' || f
  from (values ('room_ranking'), ('rate_hit')) need(f)
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
