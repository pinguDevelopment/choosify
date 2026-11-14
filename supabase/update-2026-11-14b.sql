-- Update 2 vom 14.11.: Option "Sonstige / eigene Quelle".
-- Erst nach update-2026-11-14.sql. Im Supabase-Dashboard unter "SQL Editor" einfügen und einmal ausführen.

-- Host-Option "Sonstige / eigene Quelle": Filme werden vorgeschlagen, auch wenn sie bei
-- keinem gewählten Dienst im Abo laufen (z. B. eigene Sammlung, Leihen, Mediathek).
alter table rooms add column if not exists any_source boolean not null default false;

notify pgrst, 'reload schema';
