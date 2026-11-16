[English](README.en.md) · **Deutsch**

# Cinemood

Gemeinsam schnell einen Film finden: Der Host erstellt eine Runde und wählt die Streaming-Anbieter,
alle joinen per QR-Code, wählen Genres und swipen Filme. Am Ende gewinnt der Film, den alle
(oder die meisten) sehen wollen. Filme, die die Crew schon gesehen hat, landen im **Abspann**
und werden nicht mehr vorgeschlagen.

Die Oberfläche gibt es auf Deutsch und Englisch (Sprachauswahl oben auf jeder Seite, Standard nach Browsersprache).

## Sprachen

- Texte: `src/lib/i18n/de.tsx` und `src/lib/i18n/en.tsx` (TypeScript prüft, dass keine Übersetzung fehlt).
- Fehlermeldungen der API kommen deutsch vom Server und werden im Browser übersetzt (`src/lib/i18n/errors.ts`).
- Die Adressen haben kein Sprachkürzel: `src/proxy.ts` schreibt intern auf `/de/...` bzw. `/en/...` um
  (gespeicherte Wahl im Cookie `lang`, sonst Browsersprache, sonst Englisch).
- Filmtitel und Beschreibungen werden beim Start einer Runde auf Deutsch und Englisch gespeichert,
  Genres und Tags beim Ausliefern übersetzt.

## Technik

- Next.js 16 (App Router) + Tailwind CSS 4
- Datenbank wählbar: Supabase (Standard, mit Mail-Login), MariaDB/MySQL oder SQLite (Self-Hosting, ohne Login).
  Alle Zugriffe laufen über [Kysely](https://kysely.dev), derselbe Code für alle Datenbanken (`src/lib/server/db.ts`).
- Live-Stand per regelmäßigem Nachfragen (kein Realtime nötig)
- TMDB für Filmdaten, Poster und Streaming-Anbieter

## Datenbank wählen

| `DATABASE` | Wofür | Login (Google / Mail) | Tabellen anlegen |
| --- | --- | --- | --- |
| `supabase` (Standard) | Vercel | ja | SQL aus `supabase/` im Supabase SQL Editor |
| `mariadb` / `mysql` | eigener Server | nein | macht die App selbst |
| `sqlite` | kleiner Self-Host (eine Datei) | nein | macht die App selbst |
| `postgres` | eigener Postgres-Server | nein | `supabase/setup-alles.sql` einmal ausführen |

Verbindung über `DATABASE_URL` (bei SQLite stattdessen `SQLITE_FILE`). Selbst hosten mit Docker:
siehe [docs/de/self-hosting.md](docs/de/self-hosting.md).

## Apps

- Handy (Android): [docs/de/android-app.md](docs/de/android-app.md), Download unter `/handy-app`
- Fernseher (Android TV / Fire TV): [docs/de/android-tv.md](docs/de/android-tv.md), Download unter `/tv-app`
- Login mit Google oder Mail einrichten: [docs/de/login-einrichten.md](docs/de/login-einrichten.md)
- Train my Algorithm (eigenen Geschmack trainieren): [docs/de/train-my-algorithm.md](docs/de/train-my-algorithm.md)

## Sicherheitsmodell (Kurzfassung)

- Browser sprechen nie direkt mit der Datenbank. Alles läuft über die Next.js-API, die
  Zugangsdaten zur Datenbank liegen nur auf dem Server.
- RLS ist auf allen Tabellen aktiv, ohne Policies für Client-Rollen.
- Teilnehmer, Hosts und Crews werden über zufällige 256-Bit-Tokens in httpOnly-Cookies
  erkannt. In der DB liegt nur der HMAC.
- Raum-Codes sind 10 Zeichen aus 31 Zeichen (~49 Bit) und werden mit Rate Limiting geschützt.
- Externe TMDB-Daten werden mit zod validiert, bevor sie gespeichert oder angezeigt werden.

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

Datenbank: Am einfachsten lokal `DATABASE=sqlite` in `.env.local`, dann legt die App alles selbst an.
Mit Supabase: Migrationen in `supabase/migrations/` im Supabase-Dashboard (SQL Editor) ausführen
oder mit `npx supabase db push`.

## Checks

```bash
npm test          # Unit-Tests
npm run typecheck
npm run lint
npm run e2e       # Ende-zu-Ende: Host + 2 Gäste spielen eine Runde (braucht laufenden Dev-Server)
```

Für lokale Tests ohne TMDB-Zugang `TMDB_MOCK=1` in `.env.local` setzen (wirkt nie in Produktion).
