# Filmabend – Hinweise für Claude

@AGENTS.md

Filmabend ist eine deutschsprachige Web-App für Filmabende: Eine Gruppe tritt per QR-Code einer Runde bei, jede Person wählt Genres, alle swipen durch Filmvorschläge, und am Ende steht genau ein Film fest. Der Host legt fest, welche Streaming-Anbieter zählen. Gesehene Filme landen im **Abspann** (Watchlist einer **Crew**, also einer festen Gruppe ohne Accounts) und werden nicht mehr vorgeschlagen.

Die Oberfläche und alle Texte sind Deutsch. Mit dem Nutzer wird Deutsch gesprochen. Zuerst privat im Freundeskreis, später evtl. öffentlich: Sicherheit und Skalierbarkeit von Anfang an mitdenken.

## Stack

- **Next.js 16** (App Router, `cacheComponents`, Turbopack). Diese Version weicht stark von älterem Wissen ab, siehe AGENTS.md: vorher in `node_modules/next/dist/docs/` nachlesen. Middleware heißt hier `proxy`. `PageProps`/`RouteContext` kommen aus `next typegen`.
- **Tailwind 4**: eigene Klassen als `@utility` in `src/app/globals.css`, Basisregeln in `@layer base`. Farben als Tokens (velvet, butter, ticket, yes, no).
- **motion** (`motion/react`) für Swipe-Federn und Übergänge, immer mit `MotionConfig reducedMotion="user"`.
- **Supabase (Postgres)** über PostgREST, **TMDB** für Filmdaten, Hosting auf **Vercel**.
- **zod** für jede Eingabe.

## Architektur und Sicherheitsregeln

- Der Browser spricht **nie** direkt mit der Datenbank. Alles läuft über API-Routen unter `src/app/api/` mit dem Service-Role-Key (`src/lib/server/db.ts`). RLS ist an, ohne Policies. `anon`/`authenticated` haben keine Rechte. Jede neue Tabelle braucht `enable row level security`.
- Teilnehmer und Crews haben 256-Bit-Tokens in httpOnly-Cookies (`fa_p_<code>`, `fa_crew`). In der Datenbank steht nur der HMAC mit `APP_SECRET` (`src/lib/server/tokens.ts`).
- **Konto (optional, nur für Hosts)** per Magic-Link oder Code aus der Mail (`src/lib/server/auth.ts`, `account.ts`). Supabase Auth prüft nur die E-Mail-Adresse, die Supabase-Sitzung wird verworfen. Danach gilt eine eigene Sitzung (`fa_acc`, HMAC in `account_sessions`). Für `verifyOtp` immer einen eigenen Client pro Anfrage nehmen, nie `db()`, sonst läuft der geteilte Client mit Nutzerrechten. Crews gehören dann dem Konto (`crews.account_id`), die aktive Crew steht in `fa_crew_sel` und wird bei jedem Zugriff gegen das Konto geprüft. Eine Crew vom Gerät wird nur nach Rückfrage übernommen (sonst würde ein Login auf einem fremden Gerät dessen Crew einsacken). Gäste brauchen nie ein Konto.
- Die Bestätigung des Magic-Links läuft per POST hinter einem Knopf (`/konto/bestaetigen`), weil Link-Scanner in Mailprogrammen GET-Links öffnen und das Token verbrauchen.
- Schreibende Raum-Endpunkte gehen über `roomAction` (`src/lib/server/room-route.ts`). Das deckt Origin-Check (CSRF), Rate Limit, Raum laden, Cookie prüfen und zod-Validierung ab.
- **Bewertungen im Abspann** (1 bis 5 Sterne) laufen über einen signierten Link pro Crew und Film (`/bewerten/<crewId>.<tmdbId>.<HMAC>`, `rateToken` in `tokens.ts`), damit Gäste ohne Konto bewerten können. Wer bewertet hat, erkennt der Server am Cookie `fa_rater` (in `ratings` nur der HMAC). Fremde Sterne sieht man erst nach der eigenen Bewertung. Aus den Sternen berechnet `src/lib/taste.ts` den Geschmack der Crew (Genres und Tags), der beim Start einer Runde die Auswahl sanft verschiebt.
- **Fernseher-Link / Home Assistant**: Pro Crew ein signierter Link `/tv#<crewId>.<version>.<HMAC>` (`tvToken` in `tokens.ts`, Einstellungen in `crew_tv`, Seite `/fernseher`). Der geheime Teil steht hinter `#` und geht nur im Body an `POST /api/tv`, damit er nicht in Logs landet. Der Link öffnet eine Runde ohne Host (die erste Person, die beitritt, wird Host; `participants_one_host` verhindert zwei), mit den gespeicherten Diensten, und nimmt eine laufende Runde wieder. Neue Version = alter Link ungültig. `/r/<code>/tv` ist die Großansicht jeder Runde (nur Fortschritt, keine Stimmen). Home Assistant öffnet nur diesen Link im Browser des Fernsehers, Anleitung in `docs/home-assistant.md`.
- Rate Limits pro Person (Cookie), nur ersatzweise pro IP. Teure Aktionen nutzen das geteilte Limit in Postgres (`rate_hit`).
- Entscheidungen trifft der Server: Rangliste und Gewinner kommen aus `room_ranking` bzw. der Stichwahl, nicht aus Client-Daten.
- Reine Logik ohne Server-Abhängigkeiten liegt in `src/lib/candidates.ts` und `src/lib/ranking.ts` und hat Unit-Tests.
- **Geheimnisse** (TMDB-Key, Service-Role-Key, APP_SECRET) gehören nur in `.env.local` bzw. Vercel-Umgebungsvariablen. Niemals ins Repo, in Logs, in Memory oder in Chat-Antworten. Wenn ein Nutzer einen Key in den Chat postet, ihm raten, ihn neu zu erzeugen.

## Befehle

```bash
npm run dev          # Entwicklungsserver
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm test             # Unit-Tests: node --test tests/*.test.ts
npm run e2e          # Playwright: Ablauf mit 3 Personen, Login auf mehreren Geräten, Fernseher-Link (BASE=http://localhost:3100, SHOTS=<ordner> für Screenshots)
psql -f tests/ranking.sql   # Rangliste gegen eine Test-Datenbank prüfen (läuft in einer Transaktion)
```

Lokal ohne echte Dienste: Postgres 16 + PostgREST (Docker) + kleiner Proxy unter `/rest/v1`, dazu `TMDB_MOCK=1` und `AUTH_MOCK=1` (nur außerhalb von Production; Login-Code ist dann immer 123456, der Link steht im Server-Log). TMDB und Supabase sind aus der Claude-Cloud-Umgebung blockiert, Live-Tests laufen auf dem Rechner des Nutzers.

## Datenbank

- Migrationen in `supabase/migrations/`, mit Zeitstempel im Namen. Jede Migration muss mehrfach ausführbar sein (`if not exists`, `drop ... if exists`) und endet mit `notify pgrst, 'reload schema';`.
- `supabase/setup-alles.sql` ist die Verkettung aller Migrationen für eine leere Datenbank. Nach jeder neuen Migration neu erzeugen und auf einer leeren Datenbank testen.
- Für eine bestehende Datenbank bekommt der Nutzer eine einzelne Update-Datei (z. B. `supabase/update-2026-11-14.sql`), die er im Supabase SQL Editor ausführt. Im PR und in der Antwort deutlich sagen, dass das **vor** dem Merge passieren muss.
- `alter type ... add value` nicht in derselben Migration in SQL-Funktionen verwenden (neuer Enum-Wert ist erst nach dem Commit nutzbar).

## Arbeitsweise

- Jede Änderung als eigener Branch und PR gegen `main`, keine direkten Commits auf `main`.
- Vor dem PR: typecheck, lint, Unit-Tests, E2E. Bei UI-Änderungen Screenshots (Handy-Breite) ansehen.
- Commit- und PR-Texte auf Deutsch.

## Fehler, die schon passiert sind (nicht wiederholen)

1. **`.env.example` fehlte im Repo.** `.gitignore` schloss mit `.env*` auch die Vorlage aus. Lösung: `!.env.example`. Nach dem Anlegen neuer Dateien mit `git status` prüfen, ob sie wirklich drin sind.
2. **Falsches TMDB-Key-Format.** Der Code erwartete nur das v4-Token, der Nutzer hatte den v3-API-Key (32 Hex-Zeichen). Jetzt werden beide erkannt (`src/lib/server/tmdb.ts`). Externe Zugangsdaten immer in allen gängigen Formaten akzeptieren und in `.env.example` erklären.
3. **Rate Limit pro IP statt pro Person.** Eine Gruppe im selben WLAN teilt sich eine IP und wäre beim Live-Polling ausgebremst worden. Limits laufen jetzt pro Teilnehmer-Cookie, IP nur als Rückfall. Bei Gruppen-Apps immer an geteilte Netze denken.
4. **CSRF-Check kannte die Tunnel-Adresse nicht.** Beim Testen über VS-Code-Port-Forwarding (`*.devtunnels.ms`) kam „fremde Origin“. Lösung: `ALLOWED_ORIGINS` mit Wildcards (`src/lib/origin.ts`) plus `allowedDevOrigins` in `next.config.ts`. Origin-Checks immer konfigurierbar machen und Proxys/Tunnel mitdenken.
5. **npm audit: minimatch-Lücke** in einer ESLint-Abhängigkeit. Gelöst per `overrides` in `package.json`. Nach dem Installieren `npm audit` laufen lassen.
6. **Hydration-Fehler durch Browser-Erweiterung.** Eine Erweiterung bei einem Freund setzte `data-qb-installed` auf `<html>`. Lösung: `suppressHydrationWarning` auf `<html>` in `src/app/layout.tsx`. Hydration-Warnungen, die nur bei einzelnen Personen auftreten, zuerst auf Erweiterungen prüfen.
7. **Leere Supabase-Datenbank.** Die App lief, aber Tabellen und `rate_hit` fehlten (PGRST202/PGRST205), weil das Setup-SQL nicht ausgeführt war. Bei solchen Fehlern zuerst prüfen, ob die Migrationen eingespielt sind und der Schema-Cache neu geladen wurde.
8. **Tailwind 4: „unknown utility“.** Eigene Klassen müssen als `@utility` definiert werden, nicht als normale CSS-Klassen in `@apply`. Eine globale `h1`-Regel außerhalb von `@layer base` überschrieb Utility-Klassen.
9. **Next 16: `useParams` außerhalb von Suspense** brach den Build mit `cacheComponents`. Seiten mit dynamischen Parametern als Server-Komponente bauen und `params` innerhalb von `<Suspense>` auflösen.
10. **Ref während des Renderns gelesen** (React-Lint-Regel). Für Zustände, die das Rendern beeinflussen, State statt Ref verwenden.
11. **Veraltetes CSS nach Umzug des Ordners.** `.next` löschen und den Dev-Server neu starten.
12. **Reihenfolge der Filme.** Alle drei Herr-der-Ringe-Filme kamen direkt hintereinander, weil die Kandidaten nach Score sortiert waren. Jetzt mischt `personalOrder` pro Person und verteilt Filmreihen. Ein einfacher Greedy-Ansatz reichte nicht (Reihen landeten am Ende gebündelt), deshalb gleichmäßige Verteilung über die ganze Liste.
13. **`new Array(n).map()` überspringt leere Plätze.** Für vorbelegte Arrays `Array.from({ length: n }, ...)` nehmen.
14. **E2E nach Animationen.** Direkt nach einem Swipe ist die alte Karte noch im DOM (Rausflug-Animation). Vor der nächsten Geste kurz warten und Elemente über Rolle/Name statt über Position suchen.
15. **Shell-Befehle, die auf stdin warten** (`cat > datei` ohne Heredoc) hängen in der Cloud-Session. Dateien mit Heredoc oder dem Write-Tool schreiben.
16. **Neue Spalte, alte Datenbank.** Nach dem Merge fehlte beim Nutzer `rooms.any_source` (PGRST204), weil das Update-SQL noch nicht lief. Fehlende Spalten/Tabellen/Funktionen liefern jetzt einen klaren 503 mit Hinweis (`src/lib/server/http.ts`). Bei jeder Migration im PR und in der Antwort deutlich sagen: erst SQL ausführen, dann mergen.
17. **Log-Flut durch Schrift-Warnung.** `next/font` kennt für Big Shoulders keine Fallback-Metriken und warnte bei jedem Request. Lösung: `adjustFontFallback: false` plus explizites `fallback`.
18. **Knopf blieb auf „Runde wird erstellt …“ hängen.** Mit `cacheComponents` versteckt Next.js Seiten beim Navigieren nur (React `<Activity>`) und behält ihren State. Nach erfolgreichem `router.push` stand `busy` noch auf `true`, zurück auf der Startseite war der Knopf tot. Lösung: `useLayoutEffect(() => () => setBusy(false), [])`. Bei jedem Lade-/Sende-State, der nach einer Navigation stehen bleibt, daran denken (siehe `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`).
