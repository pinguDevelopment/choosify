**English** · [Deutsch](README.de.md)

# Cinemood

Find a movie together, fast: the host creates a round and picks the streaming services,
everyone joins by QR code, chooses genres and swipes movies. The movie everyone (or most people)
wants to watch wins. Movies the crew has already seen go into the **credits**
and won't be suggested again.

The interface is available in English and German (language switch at the top of every page, default based on browser language).

## Languages

- Texts: `src/lib/i18n/de.tsx` and `src/lib/i18n/en.tsx` (TypeScript checks that no translation is missing).
- API error messages come from the server in German and are translated in the browser (`src/lib/i18n/errors.ts`).
- URLs have no language prefix: `src/proxy.ts` rewrites internally to `/de/...` or `/en/...`
  (saved choice in the `lang` cookie, otherwise browser language, otherwise English).
- Movie titles and descriptions are stored in German and English when a round starts;
  genres and tags are translated when they are served.

## Tech

- Next.js 16 (App Router) + Tailwind CSS 4
- Database of your choice: Supabase (default, with email sign-in), MariaDB/MySQL or SQLite (self-hosting, without sign-in).
  All queries go through [Kysely](https://kysely.dev), the same code for every database (`src/lib/server/db.ts`).
- Live updates by regular polling (no realtime needed)
- TMDB for movie data, posters and streaming services

## Choosing a database

| `DATABASE` | For | Sign-in (Google / email) | Creating tables |
| --- | --- | --- | --- |
| `supabase` (default) | Vercel | yes | SQL from `supabase/` in the Supabase SQL Editor |
| `mariadb` / `mysql` | your own server | no | the app does it itself |
| `sqlite` | small self-host (one file) | no | the app does it itself |
| `postgres` | your own Postgres server | no | run `supabase/setup-alles.sql` once |

Connection via `DATABASE_URL` (for SQLite use `SQLITE_FILE` instead). Self-hosting with Docker:
see [docs/en/self-hosting.md](docs/en/self-hosting.md).

## Apps

- Phone (Android): [docs/en/android-app.md](docs/en/android-app.md), download at `/handy-app`
- TV (Android TV / Fire TV): [docs/en/android-tv.md](docs/en/android-tv.md), download at `/tv-app`
- Setting up sign-in with Google or email: [docs/en/login-setup.md](docs/en/login-setup.md)
- Train my Algorithm (train your own taste): [docs/en/train-my-algorithm.md](docs/en/train-my-algorithm.md)

## Security model (short version)

- Browsers never talk to the database directly. Everything goes through the Next.js API;
  database credentials live only on the server.
- RLS is enabled on all tables, with no policies for client roles.
- Participants, hosts and crews are identified by random 256-bit tokens in httpOnly cookies.
  The database only stores their HMAC.
- Room codes are 10 characters from a 31-character alphabet (~49 bits) and are protected by rate limiting.
- External TMDB data is validated with zod before it is stored or displayed.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Database: the easiest option locally is `DATABASE=sqlite` in `.env.local`; the app then creates everything itself.
With Supabase: run the migrations in `supabase/migrations/` in the Supabase dashboard (SQL Editor)
or with `npx supabase db push`.

## Checks

```bash
npm test          # unit tests
npm run typecheck
npm run lint
npm run e2e       # end-to-end: host + 2 guests play a round (needs a running dev server)
```

For local tests without TMDB access, set `TMDB_MOCK=1` in `.env.local` (never takes effect in production).
