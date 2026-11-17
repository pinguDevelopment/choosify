# Gemeinsame Watchlist

Die **Watchlist** (früher „Abspann“) zeigt, was eure Crew schon gesehen hat, mit Sternen von allen.
Diese Filme schlägt Cinemood nicht mehr vor, und aus den Sternen lernt es euren Geschmack.

Mit Konto kannst du eine Watchlist mit anderen Konten **teilen**, z. B. mit deiner Partnerin oder deinem
Partner. Deine eigene Watchlist bleibt daneben bestehen: Du kannst beliebig viele haben (bis zu 20).

## So geht's

1. Beide melden sich an (Konto per Google oder Mail).
2. Eine Person öffnet **Konto** und legt unter **Neue gemeinsame Watchlist** eine an, z. B. „Wir zwei“.
   (Oder teilt eine schon vorhandene Watchlist, dann wandert deren Inhalt mit.)
3. Bei der Watchlist auf **Teilen & verwalten** tippen, dann **Einladungslink erstellen**.
   Den Link verschicken oder den QR-Code mit dem anderen Handy scannen.
4. Die andere Person öffnet den Link, meldet sich falls nötig an und tippt **Beitreten**.

Ab jetzt seht ihr beide dieselbe Watchlist mit denselben Sternen. Wer Filme einträgt, löscht oder bewertet,
ändert sie für alle.

## Umschalten

Auf der Seite **Watchlist** stehen oben alle deine Watchlists (👥 = geteilt). Ein Tipp schaltet um.
Die ausgewählte Watchlist gilt auch für neue Runden: Deren Filme werden nicht vorgeschlagen, und der
Gewinner landet dort.

## Wer darf was

- Alle Mitglieder dürfen Filme eintragen, entfernen, bewerten, den Namen ändern und neue Einladungslinks erstellen.
- Nur wer die Watchlist angelegt hat, darf andere entfernen.
- Jedes Mitglied kann selbst **austreten**. Tritt die Person aus, die sie angelegt hat, übernimmt das Mitglied,
  das am längsten dabei ist.
- Wer die Watchlist angelegt hat, kann sie unter **Teilen & verwalten → Watchlist löschen** löschen
  (mit Rückfrage). Sie ist dann samt Filmen und Sternen für alle weg. Das geht auch bei einer eigenen,
  nicht geteilten Watchlist.
- Mitglieder sehen voneinander nur den Teil der E-Mail-Adresse vor dem @.

## Einladungslinks

- Ein Link gilt 7 Tage. Ein neuer Link ersetzt den alten, **Link ungültig machen** stoppt ihn sofort.
- Wir zeigen jeden Link nur einmal. In der Datenbank steht nur eine verschlüsselte Prüfsumme davon.
- Wer den Link hat, kann beitreten. Schick ihn also nur an Leute, die mitmachen sollen.

Beim Self-Hosten (MariaDB, MySQL, SQLite) gibt es keine Konten und darum auch keine geteilten Watchlists.
Die Watchlist hängt dort am Browser.

## Datenbank-Update (nur Supabase)

Vor dem Update der App einmal `supabase/update-2026-11-17-gemeinsam.sql` (oder `supabase/update-auf-aktuell.sql`)
im Supabase SQL Editor ausführen. MariaDB, MySQL und SQLite legen die neuen Tabellen selbst an.
