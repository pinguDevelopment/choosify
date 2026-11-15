-- Mehrsprachigkeit: englischer Titel und Beschreibung pro Film, damit die englische Oberfläche
-- nicht bei jedem Abruf TMDB fragen muss. Die deutschen Texte stehen weiter in title/overview.
-- Fehlt der englische Text (ältere Runden), zeigt die englische Oberfläche den deutschen.
alter table room_movies add column if not exists title_en text;
alter table room_movies add column if not exists overview_en text;
alter table room_movies drop constraint if exists room_movies_title_en_check;
alter table room_movies add constraint room_movies_title_en_check check (char_length(title_en) <= 300);
alter table room_movies drop constraint if exists room_movies_overview_en_check;
alter table room_movies add constraint room_movies_overview_en_check check (char_length(overview_en) <= 2000);
alter table abspann add column if not exists title_en text;
alter table abspann drop constraint if exists abspann_title_en_check;
alter table abspann add constraint abspann_title_en_check check (char_length(title_en) <= 300);

notify pgrst, 'reload schema';
