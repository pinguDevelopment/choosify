-- Fernseher-Link pro Crew: Ein geheimer Link öffnet auf dem Fernseher (oder per Home Assistant)
-- automatisch eine neue Runde und zeigt den QR-Code zum Beitreten.
-- Der Link selbst steht nicht in der Datenbank: Er ist mit APP_SECRET signiert und enthält die
-- Versionsnummer. "Neuen Link erzeugen" erhöht die Version, damit hört der alte Link auf zu gehen.
-- Dazu gespeichert: welche Dienste für Runden vom Fernseher gelten.

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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

notify pgrst, 'reload schema';
