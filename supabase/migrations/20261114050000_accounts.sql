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
