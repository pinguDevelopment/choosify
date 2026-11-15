-- Erscheinungsjahr-Filter: Der Host legt beim Erstellen der Runde fest, aus welchem Zeitraum
-- die Filme kommen (z. B. "ab 2000" oder 1980 bis 1999). null = keine Grenze.
alter table rooms add column if not exists year_from smallint;
alter table rooms add column if not exists year_to smallint;
alter table rooms drop constraint if exists rooms_years_check;
alter table rooms add constraint rooms_years_check check (
  (year_from is null or year_from between 1900 and 2100)
  and (year_to is null or year_to between 1900 and 2100)
  and (year_from is null or year_to is null or year_from <= year_to)
);

notify pgrst, 'reload schema';
