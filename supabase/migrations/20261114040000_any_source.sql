-- Host-Option "Sonstige / eigene Quelle": Filme werden vorgeschlagen, auch wenn sie bei
-- keinem gewählten Dienst im Abo laufen (z. B. eigene Sammlung, Leihen, Mediathek).
alter table rooms add column if not exists any_source boolean not null default false;

notify pgrst, 'reload schema';
