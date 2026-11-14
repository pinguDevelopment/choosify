-- Bewertungen im Abspann: Nach dem Film vergibt jede Person 1 bis 5 Sterne.
-- Gäste brauchen kein Konto: Sie bewerten über einen signierten Link (bzw. QR-Code) pro
-- Film und Crew. Wer bewertet hat, erkennt der Server an einem eigenen 256-Bit-Token im
-- httpOnly-Cookie (fa_rater); in der Datenbank steht wie überall nur der HMAC.
-- Aus den Sternen lernt die App den Geschmack der Crew (Genres und Tags der Filme).

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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

notify pgrst, 'reload schema';
