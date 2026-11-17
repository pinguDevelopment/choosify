**English** · [Deutsch](../de/self-hosting.md)

# Self-hosting Cinemood

Cinemood also runs without Supabase and Vercel on your own machine (Raspberry Pi, NAS, server).
The data is then stored in an **SQLite file** or in **MariaDB/MySQL**. There is no email sign-in
when self-hosting: everyone simply joins by QR code, and the crew and the watchlist are tied to the
host's browser.

## Quick start with Docker (SQLite)

1. Download the repository and create a file called `.env`:

   ```env
   TMDB_READ_TOKEN=your-tmdb-token
   APP_SECRET=a-long-random-value-at-least-32-characters
   ```

   Generate `APP_SECRET` e.g. with `openssl rand -base64 32`. You can get the TMDB token at
   https://www.themoviedb.org/settings/api.

2. Start it:

   ```bash
   docker compose up -d
   ```

3. Open `http://<IP-of-the-machine>:3000` in your browser. Phones on the same Wi-Fi can then scan
   the QR code directly.

The database lives in the Docker volume `cinemood-data` (file `/data/cinemood.db`). The app creates the
tables on first start; nobody needs to run any SQL.

## MariaDB instead of SQLite

In `docker-compose.yml`, uncomment the `mariadb` block and set this on the `cinemood` service:

```yaml
    environment:
      DATABASE: mariadb
      DATABASE_URL: mysql://cinemood:secret@mariadb:3306/cinemood
```

An existing MariaDB or MySQL server works the same way; just point `DATABASE_URL` at that server.
The database (here `cinemood`) must exist; the app creates the tables.
Tested with MariaDB 10.11.

## Without Docker

```bash
npm ci
DATABASE=sqlite ALLOW_HTTP=1 npm run build
DATABASE=sqlite ALLOW_HTTP=1 npm start
```

The values from `.env` (or `.env.local`) apply here too. Set `DATABASE` and `ALLOW_HTTP` already when
building, because the pages are prepared during the build.

## HTTPS or not?

- **Home network only** (`http://192.168...`): `ALLOW_HTTP=1` (already set in the Docker image). Otherwise
  browsers would discard the round's sign-in cookies.
- **Reachable from the internet**: always put it behind a reverse proxy with HTTPS (e.g. Caddy, Traefik,
  Nginx Proxy Manager) and set `ALLOW_HTTP=0`.

## All settings

| Variable | Meaning |
| --- | --- |
| `DATABASE` | `sqlite`, `mariadb`, `mysql`, `postgres` or `supabase` |
| `DATABASE_URL` | connection, e.g. `mysql://user:pass@host:3306/cinemood` (not for SQLite) |
| `SQLITE_FILE` | location of the SQLite file (Docker: `/data/cinemood.db`) |
| `TMDB_READ_TOKEN` | TMDB access for movies, posters and streaming services |
| `APP_SECRET` | secret random value, never change it (otherwise all crews/links become invalid) |
| `ALLOW_HTTP` | `1` = running without HTTPS is allowed |
| `ALLOWED_ORIGINS` | additional allowed addresses, if the app is reachable under several names |

With MariaDB and SQLite the app cleans up expired rounds itself (at most once per hour).

## Backups

SQLite: the file `cinemood.db` (while the app is running, preferably with `sqlite3 cinemood.db ".backup copy.db"`).
MariaDB: as usual with `mariadb-dump`.
