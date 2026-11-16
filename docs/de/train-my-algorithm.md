# Train my Algorithm

Mit **Train my Algorithm** bringt jede Person Cinemood ihren eigenen Filmgeschmack bei, ganz allein und
so lange sie will. In Gruppenrunden werden die Filme dann auch danach ausgesucht.

## So geht's

1. Anmelden (Konto, per Google oder Mail). Ohne Konto gibt es nichts, wo der Geschmack gespeichert werden könnte.
2. Auf der Startseite oder im Konto **Train my Algorithm** öffnen (Adresse `/trainieren`).
3. Durch die Filme wischen:
   - → **Mag ich**, ↑ **Geht so**, ← **Nicht meins**
   - **Weiß nicht** (↓) überspringt einen Film, ohne etwas zu speichern
   - **Zurück** (Rücktaste) nimmt die letzte Karte zurück, Antippen zeigt Details und Trailer
   - Ob man den Film gesehen hat, ist egal: Es geht nur darum, ob er „dein Ding“ ist.
4. Unter dem Stapel steht, was Cinemood schon gelernt hat (Genres und #Tags, die du magst oder eher nicht).

Die Filme kommen bunt gemischt aus allen Jahrzehnten und Töpfen (beliebt, Klassiker, Geheimtipps),
ohne Streaming-Filter. Schon bewertete Filme kommen nicht noch einmal.

## Was in Gruppenrunden passiert

Wer **angemeldet** einer Runde beitritt (oder sie erstellt), bringt seinen Geschmack mit:

- **Filmauswahl:** Beim Start der Runde rücken Filme mit Genres und Tags, die den Trainierten gefallen,
  nach vorne, und unbeliebte nach hinten. Mehrere Trainierte werden gemittelt, damit niemand die Runde
  allein bestimmt. Die Sterne aus dem Abspann der Crew zählen wie bisher mit (je zur Hälfte).
  Ein Film, den jemand ausdrücklich mit „Nicht meins“ bewertet hat, rutscht deutlich nach hinten.
- **Eigene Reihenfolge:** Jede trainierte Person sieht Filme nach ihrem Geschmack etwas früher in ihrem Stapel.
  Alle swipen trotzdem dieselben Filme.
- Die anderen sehen deine Trainings-Stimmen nie.

Mit dem Schalter **In Gruppenrunden nutzen** (auf der Trainings-Seite) lässt sich das abschalten,
dann bleibt das Training nur gespeichert. **Training zurücksetzen** löscht alle Stimmen,
einzelne Filme lassen sich unter „Zuletzt bewertet“ vergessen.

## Einrichtung

- **Supabase:** Vor dem Update einmal `supabase/update-2026-11-16-training.sql` (oder wie immer
  `supabase/update-auf-aktuell.sql`) im Supabase SQL Editor ausführen.
- **MariaDB/MySQL/SQLite:** nichts zu tun, die App legt die neuen Tabellen selbst an.
  Ohne Konten (Self-Host ohne Login) gibt es den Modus nicht.

Neu in der Datenbank: Tabelle `training_votes` (Stimmen pro Konto, höchstens 3000), Spalte
`accounts.use_training` (der Schalter) und `participants.account_id` (welches Konto in einer Runde mitmacht).
