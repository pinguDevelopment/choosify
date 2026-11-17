-- Gemeinsame Watchlist: Eine Crew kann mehreren Konten gehören
-- (z. B. dir und deiner Partnerin). Die Besitzerin steht weiter in crews.account_id,
-- alle weiteren Mitglieder hier. Eigene Crews bleiben daneben ganz normal erhalten.
create table if not exists crew_members (
  crew_id     uuid not null references crews(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (crew_id, account_id)
);
create index if not exists crew_members_account_idx on crew_members (account_id);
alter table crew_members enable row level security;

-- Einladungslink einer Crew: In der Datenbank steht nur der HMAC des Links.
-- Ein neuer Link ersetzt den alten, nach 7 Tagen läuft er ab.
alter table crews add column if not exists invite_hash text;
alter table crews add column if not exists invite_expires_at timestamptz;
alter table crews drop constraint if exists crews_invite_hash_check;
alter table crews add constraint crews_invite_hash_check check (char_length(invite_hash) = 64);
create unique index if not exists crews_invite_hash_idx on crews (invite_hash);
