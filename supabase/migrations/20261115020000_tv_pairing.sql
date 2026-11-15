-- Fernseher koppeln: Der Fernseher öffnet /tv und zeigt einen kurzen Code (6 Zeichen).
-- Der Host gibt ihn in der Lobby ein, danach zeigt der Fernseher den QR-Code dieser Runde.
-- secret_hash: HMAC des Geheimnisses, das nur der Fernseher kennt (damit fragt er nach).
-- Ein freier Code gilt 15 Minuten, nach dem Koppeln so lange wie die Runde.
create table if not exists tv_pairings (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  secret_hash  text not null unique check (char_length(secret_hash) = 64),
  room_id      uuid references rooms(id) on delete cascade,
  linked_at    timestamptz,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists tv_pairings_expires_idx on tv_pairings (expires_at);

alter table tv_pairings enable row level security;

-- Der alte feste Fernseher-Link (für Home Assistant) ist durch das Koppeln ersetzt.
drop table if exists crew_tv;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;

notify pgrst, 'reload schema';
