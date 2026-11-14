-- Security-Härtung (Schritt 4)

-- Rate Limiting über alle Server-Instanzen hinweg (Token-Bucket in Postgres).
create table rate_limits (
  key        text primary key check (char_length(key) <= 200),
  tokens     double precision not null,
  updated_at timestamptz not null default now()
);
alter table rate_limits enable row level security;

-- true = Anfrage erlaubt. Atomar dank Zeilensperre (FOR UPDATE über upsert).
create or replace function rate_hit(p_key text, p_per_minute integer, p_burst integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_tokens double precision;
begin
  insert into rate_limits as r (key, tokens, updated_at)
  values (p_key, p_burst - 1, now())
  on conflict (key) do update
    set tokens = least(p_burst::double precision,
                       r.tokens + extract(epoch from (now() - r.updated_at)) / 60.0 * p_per_minute) - 1,
        updated_at = now()
  returning tokens into v_tokens;

  if v_tokens < 0 then
    -- abgelehnt: Verbrauch nicht anrechnen, damit Dauerfeuer nicht ewig sperrt
    update rate_limits set tokens = 0 where key = p_key;
    return false;
  end if;
  return true;
end
$$;

-- Abspann pro Crew begrenzen (Missbrauchsschutz).
create or replace function abspann_limit() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from abspann where crew_id = new.crew_id) >= 2000 then
    raise exception 'Abspann ist voll' using errcode = 'P0001';
  end if;
  return new;
end
$$;
create trigger abspann_limit before insert on abspann
  for each row execute function abspann_limit();

-- Aufräumen: abgelaufene Räume und alte Rate-Limit-Einträge.
create or replace function cleanup_expired_rooms()
returns integer
language sql
set search_path = public
as $$
  with d as (delete from rooms where expires_at < now() returning 1),
       r as (delete from rate_limits where updated_at < now() - interval '1 hour' returning 1)
  select (select count(*) from d)::int
$$;

-- Stündlich aufräumen, falls pg_cron verfügbar ist (in Supabase: Database -> Extensions -> pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('choosify-cleanup', '17 * * * *', 'select public.cleanup_expired_rooms()');
  end if;
exception when others then
  raise notice 'pg_cron nicht eingerichtet: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated, public;
  end if;
end $$;
