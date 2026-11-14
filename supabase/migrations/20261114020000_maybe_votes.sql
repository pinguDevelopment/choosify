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
