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
