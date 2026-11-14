# Security-Audit (Stand 14.11.2026)

Geprüft nach OWASP Top 10 (2021) und der OWASP-ASVS-Checkliste für Web-Apps ohne Accounts.

## Ergebnis

| Bereich | Status | Umsetzung |
|---|---|---|
| A01 Zugriffskontrolle | ✅ | Jede Aktion prüft den Teilnehmer per httpOnly-Cookie. Nur der Host darf starten oder beenden. Nicht-Mitglieder sehen weder Teilnehmer noch Filme. Abspann nur mit Crew-Cookie. |
| A01 Datenbank | ✅ | RLS auf allen Tabellen, ohne Policies für `anon`/`authenticated`, Rechte entzogen. Getestet: der anon-Key bekommt `permission denied`. |
| A02 Kryptografie | ✅ | Tokens aus 256 Bit Zufall, in der DB nur HMAC-SHA256 mit `APP_SECRET`, Vergleich in konstanter Zeit. HTTPS per HSTS erzwungen. |
| A03 Injection / XSS | ✅ | Supabase-Client nutzt parametrisierte Abfragen. Alle Eingaben werden mit zod validiert, Namen ohne Steuerzeichen und `<>`. React escaped alle Ausgaben, kein `dangerouslySetInnerHTML`. TMDB-Antworten werden validiert, Posterpfade per Regex geprüft. |
| A04 Unsicheres Design | ✅ | Raum-Codes mit ca. 49 Bit, Räume laufen nach 24 h ab. Limits: 30 Personen pro Runde, 30 Filme, 2000 Abspann-Einträge. |
| A05 Fehlkonfiguration | ✅ | CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, COOP, `nosniff`, Referrer-Policy, Permissions-Policy, kein `X-Powered-By`. Fehlermeldungen an Clients ohne interne Details. |
| A06 Abhängigkeiten | ✅ | `npm audit --omit=dev`: 0 Schwachstellen. 8 „moderate“ betreffen nur das Entwicklungswerkzeug ESLint und landen nicht in der App. |
| A07 Authentifizierung | ✅ | Keine Passwörter. Cookies `httpOnly`, `Secure` (Produktion), `SameSite=Lax`. |
| A08 Integrität | ✅ | Abspann-Daten holt der Server selbst bei TMDB, Client-Angaben zu Filmen werden nicht übernommen. |
| A09 Logging | ⚠️ | Serverfehler landen im Vercel-Log. Ein Alarm bei Häufung ist für den privaten Betrieb nicht nötig. |
| A10 SSRF | ✅ | Der Server ruft nur feste TMDB-URLs auf, Nutzereingaben landen nur als Query-Parameter. |
| CSRF | ✅ | Origin muss zum Host passen, nur `application/json`, SameSite-Cookies. |
| Missbrauch / DoS | ✅ | Zwei Stufen Rate Limiting: im Speicher und geteilt über Postgres (`rate_hit`) für Erstellen, Beitreten, Suche, Start/Ende und Abspann. Gezählt wird pro Teilnehmer, damit Gruppen im selben WLAN nicht ausgebremst werden. Request-Bodies max. 8 KB. |

## Bewusste Kompromisse

- **CSP mit `'unsafe-inline'` für Skripte:** Next.js liefert mit Cache Components Inline-Skripte im statischen Shell aus. Nonces würden das Prerendering abschalten. Das Restrisiko ist gering, weil es keinen Weg gibt, eigenes HTML einzuschleusen (siehe A03).
- **Client-IP:** Für das IP-Limit wird `x-real-ip`/`x-forwarded-for` genutzt. Auf Vercel setzt die Plattform diese Header. Wer hinter einem anderen Proxy hostet, muss das prüfen.
- **Wer den Raum-Link hat, kann beitreten.** Das ist gewollt (QR-Code). Wer öffentlich teilt, teilt auch die Runde.

## Wenn die App öffentlich wird

- Supabase-Logs und Vercel-Firewall-Regeln beobachten
- Optional: Turnstile/Captcha beim Erstellen von Runden
- Regelmäßig `npm audit` und Dependabot aktivieren

## Prüfen

`npm run e2e` enthält Negativtests: fremde Origin, falscher Content-Type, HTML im Namen, Gast startet Runde, Abstimmen ohne Beitritt, keine Datenlecks an Nicht-Mitglieder, httpOnly-Cookies, CSP-Verstöße und Rate Limit.
