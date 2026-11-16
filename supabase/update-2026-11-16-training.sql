-- Cinemood Update vom 16.11.2026: „Train my Algorithm“.
-- Im Supabase SQL Editor komplett einfügen und auf "Run" klicken. Darf mehrfach laufen.
-- Alternativ einfach supabase/update-auf-aktuell.sql ausführen, das enthält dieses Update auch.

-- „Train my Algorithm“: Angemeldete swipen allein durch Filme, damit Cinemood ihren Geschmack lernt.
-- Die Stimmen gehören dem Konto (1 = mag ich, 0 = geht so, -1 = nicht meins). Genres und Tags
-- werden mitgespeichert, damit der Geschmack ohne weitere TMDB-Abrufe berechnet werden kann.
create table if not exists training_votes (
  account_id    uuid not null references accounts(id) on delete cascade,
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
create index if not exists training_votes_recent_idx on training_votes (account_id, voted_at desc);
alter table training_votes enable row level security;

-- Schalter im Konto: trainierten Geschmack in Gruppenrunden nutzen (Standard: an).
alter table accounts add column if not exists use_training boolean not null default true;

-- Wer angemeldet einer Runde beitritt, wird mit seinem Konto verknüpft. So fließt sein
-- trainierter Geschmack in die Filmauswahl der Runde ein. Andere sehen das Konto nie.
alter table participants add column if not exists account_id uuid references accounts(id) on delete set null;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

notify pgrst, 'reload schema';
