# Cinemood zum Selbst-Hosten. Standard: SQLite in einer Datei unter /data, ohne Mail-Login.
# Bauen:   docker build -t cinemood .
# Starten: siehe docker-compose.yml oder docs/self-hosting.md

# Volles Image zum Installieren: better-sqlite3 wird dabei übersetzt (braucht python3, make, g++)
FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE und ALLOW_HTTP wirken schon beim Bauen (Konto-Links, HTTPS-Umleitung in den Seiten)
ARG DATABASE=sqlite
ARG ALLOW_HTTP=1
ENV DATABASE=$DATABASE ALLOW_HTTP=$ALLOW_HTTP STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ARG DATABASE=sqlite
ARG ALLOW_HTTP=1
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE=$DATABASE ALLOW_HTTP=$ALLOW_HTTP SQLITE_FILE=/data/cinemood.db
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# better-sqlite3 lädt die App erst zur Laufzeit, deshalb fehlt es im Standalone-Ordner
COPY --from=deps --chown=node:node /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
