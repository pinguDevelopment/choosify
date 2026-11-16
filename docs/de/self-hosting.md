[English](../en/self-hosting.md) · **Deutsch**

# Cinemood selbst hosten

Cinemood läuft auch ohne Supabase und Vercel auf einem eigenen Rechner (Raspberry Pi, NAS, Server).
Die Daten liegen dann in einer **SQLite-Datei** oder in **MariaDB/MySQL**. Einen Mail-Login gibt es
beim Self-Hosten nicht: Alle treten einfach per QR-Code bei, die Crew und der Abspann hängen am Browser
des Hosts.

## Schnellstart mit Docker (SQLite)

1. Repository herunterladen und eine Datei `.env` anlegen:

   ```env
   TMDB_READ_TOKEN=dein-tmdb-token
   APP_SECRET=ein-langer-zufälliger-wert-mindestens-32-zeichen
   ```

   `APP_SECRET` z. B. mit `openssl rand -base64 32` erzeugen. Den TMDB-Token gibt es unter
   https://www.themoviedb.org/settings/api.

2. Starten:

   ```bash
   docker compose up -d
   ```

3. Im Browser `http://<IP-des-Rechners>:3000` öffnen. Die Handys im selben WLAN können den QR-Code
   dann direkt scannen.

Die Datenbank liegt im Docker-Volume `cinemood-data` (Datei `/data/cinemood.db`). Tabellen legt die App
beim ersten Start selbst an, SQL muss niemand ausführen.

## MariaDB statt SQLite

In `docker-compose.yml` den `mariadb`-Block einkommentieren und beim Dienst `cinemood` setzen:

```yaml
    environment:
      DATABASE: mariadb
      DATABASE_URL: mysql://cinemood:geheim@mariadb:3306/cinemood
```

Ein vorhandener MariaDB- oder MySQL-Server geht genauso, dann nur `DATABASE_URL` auf diesen Server zeigen
lassen. Die Datenbank (hier `cinemood`) muss existieren, die Tabellen legt die App an.
Getestet mit MariaDB 10.11.

## Ohne Docker

```bash
npm ci
DATABASE=sqlite ALLOW_HTTP=1 npm run build
DATABASE=sqlite ALLOW_HTTP=1 npm start
```

Die Werte aus `.env` (bzw. `.env.local`) gelten auch hier. `DATABASE` und `ALLOW_HTTP` schon beim Bauen
setzen, weil die Seiten dabei fertig vorbereitet werden.

## HTTPS oder nicht?

- **Nur im Heimnetz** (`http://192.168...`): `ALLOW_HTTP=1` (im Docker-Image schon gesetzt). Sonst würden
  Browser die Anmelde-Cookies der Runde verwerfen.
- **Im Internet erreichbar**: unbedingt hinter einen Reverse Proxy mit HTTPS (z. B. Caddy, Traefik,
  Nginx Proxy Manager) stellen und `ALLOW_HTTP=0` setzen.

## Alle Einstellungen

| Variable | Bedeutung |
| --- | --- |
| `DATABASE` | `sqlite`, `mariadb`, `mysql`, `postgres` oder `supabase` |
| `DATABASE_URL` | Verbindung, z. B. `mysql://user:pass@host:3306/cinemood` (nicht bei SQLite) |
| `SQLITE_FILE` | Ort der SQLite-Datei (Docker: `/data/cinemood.db`) |
| `TMDB_READ_TOKEN` | TMDB-Zugang für Filme, Poster und Streaming-Dienste |
| `APP_SECRET` | geheimer Zufallswert, nie ändern (sonst sind alle Crews/Links ungültig) |
| `ALLOW_HTTP` | `1` = Betrieb ohne HTTPS erlaubt |
| `ALLOWED_ORIGINS` | weitere erlaubte Adressen, falls die App unter mehreren Namen erreichbar ist |

Abgelaufene Runden räumt die App bei MariaDB und SQLite selbst auf (höchstens einmal pro Stunde).

## Sichern

SQLite: die Datei `cinemood.db` (bei laufender App am besten mit `sqlite3 cinemood.db ".backup kopie.db"`).
MariaDB: wie gewohnt mit `mariadb-dump`.
