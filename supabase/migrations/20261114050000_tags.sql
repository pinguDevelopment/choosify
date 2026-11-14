-- Stimmungs-Tags auf den Abstimmkarten (#lustig, #zeitreise, …). Werden beim Start der Runde
-- aus TMDB-Genres und -Schlagwörtern berechnet und hier gespeichert, damit beim Swipen kein
-- weiterer TMDB-Abruf nötig ist. runtime_min gab es schon, wird jetzt auch befüllt.
alter table room_movies add column if not exists tags text[] not null default '{}';
alter table room_movies drop constraint if exists room_movies_tags_check;
alter table room_movies add constraint room_movies_tags_check check (cardinality(tags) <= 6);

notify pgrst, 'reload schema';
