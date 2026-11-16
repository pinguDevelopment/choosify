import "server-only";
import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect, sql, type Dialect, type InsertObject, type KyselyPlugin, type PluginTransformQueryArgs, type PluginTransformResultArgs, type QueryResult, type RootOperationNode, type UnknownRow } from "kysely";
import type { DB } from "./db-types";
import { ensureSchema } from "./db-schema";

/**
 * Datenbank wählen mit DATABASE:
 *   supabase (Standard) – Postgres von Supabase, Verbindung über DATABASE_URL. Nur hier gibt es den Mail-Login.
 *   postgres            – eigener Postgres-Server (Schema aus supabase/setup-alles.sql), ohne Login.
 *   mariadb / mysql     – eigener MariaDB- oder MySQL-Server über DATABASE_URL (mysql://...). Tabellen legt die App selbst an.
 *   sqlite              – eine Datei (SQLITE_FILE, Standard data/cinemood.db). Für kleine Self-Hosts, kein Datenbankserver nötig.
 *
 * Alle Zugriffe laufen über Kysely, damit derselbe Code mit allen drei Datenbanken funktioniert.
 * Unterschiede (Listen, Wahrheitswerte, Zeitstempel) gleichen die Treiber-Hüllen unten aus:
 * Im Code sind Listen immer Arrays, Wahrheitswerte booleans und Zeitstempel ISO-Strings (UTC).
 */
export type DbKind = "supabase" | "postgres" | "mysql" | "sqlite";
export type Dialect3 = "postgres" | "mysql" | "sqlite";

export function dbKind(): DbKind {
  const v = (process.env.DATABASE ?? "supabase").trim().toLowerCase();
  if (v === "supabase" || v === "postgres" || v === "sqlite") return v;
  if (v === "mariadb" || v === "mysql") return "mysql";
  throw new Error(`Unbekannte Datenbank in DATABASE: "${v}". Erlaubt: supabase, postgres, mariadb, mysql, sqlite.`);
}

export function dialect(): Dialect3 {
  const k = dbKind();
  return k === "supabase" ? "postgres" : k;
}

/**
 * Konten (Mail-Login) gibt es nur mit Supabase, weil Supabase die Anmelde-Mails verschickt.
 * Beim Self-Hosten braucht es keine Konten: Alle treten einfach per QR-Code bei.
 */
export function accountsEnabled(): boolean {
  // AUTH_MOCK (nur für Tests, nie in Produktion) erlaubt den Login auch mit den anderen Datenbanken
  const mock = process.env.AUTH_MOCK === "1" && process.env.NODE_ENV !== "production";
  return dbKind() === "supabase" || mock;
}

let instance: Kysely<DB> | null = null;
let ready: Promise<void> | null = null;

/** Datenbankzugriff (nur auf dem Server). Legt bei MariaDB/SQLite beim ersten Zugriff die Tabellen an. */
export function db(): Kysely<DB> {
  if (!instance) {
    instance = new Kysely<DB>({ dialect: makeDialect(), plugins: [new NormalizePlugin()] });
    ready = dialect() === "postgres" ? Promise.resolve() : ensureSchema(instance, dialect() as "mysql" | "sqlite");
    ready.catch(() => {}); // Fehler meldet dbReady()
  }
  return instance;
}

/** Wartet, bis die Tabellen angelegt sind. Wird vor jeder Anfrage in handle() aufgerufen. */
export async function dbReady(): Promise<void> {
  db();
  try {
    await ready;
  } catch (err) {
    // Beim nächsten Versuch neu anlegen (z. B. Datenbankserver war beim Start noch nicht da)
    ready = ensureSchema(instance!, dialect() as "mysql" | "sqlite");
    ready.catch(() => {});
    throw err;
  }
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      dbKind() === "supabase"
        ? "DATABASE_URL fehlt. In Supabase: Connect -> Transaction pooler -> URI kopieren und das Passwort einsetzen."
        : "DATABASE_URL fehlt, z. B. mysql://cinemood:passwort@localhost:3306/cinemood",
    );
  }
  return url;
}

function makeDialect(): Dialect {
  switch (dialect()) {
    case "postgres":
      return postgresDialect();
    case "mysql":
      return mysqlDialect();
    case "sqlite":
      return sqliteDialect();
  }
}

// ---- Postgres / Supabase -----------------------------------------------------

function postgresDialect(): Dialect {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  const url = new URL(databaseUrl());
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname) || process.env.DATABASE_SSL === "0";
  // sslmode in der Adresse würde die Einstellung unten überschreiben
  url.searchParams.delete("sslmode");
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  return new PostgresDialect({
    pool: new Pool({
      connectionString: url.toString(),
      // Supabase verlangt TLS. Ohne eigenes CA-Zertifikat wird nur verschlüsselt, nicht das Zertifikat geprüft.
      ssl: local ? false : ca ? { ca } : { rejectUnauthorized: false },
      // Serverless (Vercel): wenige Verbindungen pro Instanz, der Supabase-Pooler verteilt sie.
      max: Number(process.env.DATABASE_POOL_SIZE ?? 3),
      idleTimeoutMillis: 10_000,
    }),
  });
}

// ---- MariaDB / MySQL ------------------------------------------------------------

function mysqlDialect(): Dialect {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mysql = require("mysql2") as typeof import("mysql2");
  const raw = mysql.createPool({
    uri: databaseUrl(),
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    // Zeitstempel als Text lesen (UTC), die Umrechnung macht NormalizePlugin
    dateStrings: true,
    timezone: "Z",
    supportBigNumbers: true,
    charset: "utf8mb4_unicode_ci",
  });
  raw.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  type Conn = { query: (sql: string, params: unknown[], cb?: unknown) => unknown; release: () => void };
  const pool = {
    getConnection(cb: (err: unknown, conn?: unknown) => void) {
      raw.getConnection((err, conn) => {
        if (err) return cb(err);
        const c = conn as unknown as Conn;
        cb(null, {
          query: (s: string, p: unknown[], callback?: unknown) => c.query(s, (p ?? []).map(encodeMysql), callback),
          release: () => c.release(),
        });
      });
    },
    end(cb: (err?: unknown) => void) {
      raw.end((err) => cb(err ?? undefined));
    },
  };
  return new MysqlDialect({ pool: pool as never });
}

const ISO = /^(\d{4}-\d\d-\d\d)T(\d\d:\d\d:\d\d(?:\.\d{1,3})?)\d*Z$/;

function encodeMysql(v: unknown): unknown {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (v instanceof Date) return v.toISOString().replace("T", " ").replace("Z", "");
  if (typeof v === "string") {
    const m = ISO.exec(v);
    if (m) return `${m[1]} ${m[2]}`;
  }
  return v;
}

// ---- SQLite ---------------------------------------------------------------------

function sqliteDialect(): Dialect {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const path = require("node:path") as typeof import("node:path");
  const fs = require("node:fs") as typeof import("node:fs");
  const { createRequire } = require("node:module") as typeof import("node:module");
  /* eslint-enable @typescript-eslint/no-require-imports */
  // better-sqlite3 ist optional (natives Modul, auf Vercel nicht nötig). Zur Laufzeit laden,
  // damit der Build auch ohne das Paket klappt. Das Docker-Image kopiert es extra mit.
  let Database: typeof import("better-sqlite3");
  try {
    Database = createRequire(path.join(process.cwd(), "package.json"))("better-sqlite3");
  } catch {
    throw new Error("Für DATABASE=sqlite fehlt das Paket better-sqlite3. Bitte `npm install better-sqlite3` ausführen.");
  }
  const file = process.env.SQLITE_FILE?.trim() || path.join(process.cwd(), "data", "cinemood.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new Database(file);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("busy_timeout = 5000");
  const enc = (p: readonly unknown[]) => p.map(encodeSqlite);
  const database = {
    close: () => raw.close(),
    prepare(s: string) {
      const st = raw.prepare(s);
      return {
        get reader() {
          return st.reader;
        },
        all: (p: readonly unknown[]) => st.all(enc(p)),
        run: (p: readonly unknown[]) => st.run(enc(p)),
        iterate: (p: readonly unknown[]) => st.iterate(enc(p)),
      };
    },
  };
  return new SqliteDialect({ database: database as never });
}

function encodeSqlite(v: unknown): unknown {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  return v;
}

// ---- Ergebnisse vereinheitlichen -----------------------------------------------

const ARRAY_COLUMNS = new Set(["provider_ids", "runoff_ids", "genre_ids", "tags", "favorite_provider_ids"]);
const BOOL_COLUMNS = new Set(["is_host", "genres_done", "winner_to_abspann", "any_source", "favorite_other", "use_training"]);
const NUMBER_COLUMNS = new Set(["vote_average", "n", "tokens"]);
const MYSQL_TIME = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)(\.\d+)?$/;

function normalizeValue(key: string, v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (ARRAY_COLUMNS.has(key) && typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (BOOL_COLUMNS.has(key) && typeof v !== "boolean") return Boolean(Number(v));
  if (v instanceof Date) return v.toISOString();
  if (key.endsWith("_at") && typeof v === "string") {
    const m = MYSQL_TIME.exec(v);
    if (m) return new Date(`${m[1]}T${m[2]}${m[3] ?? ""}Z`).toISOString();
    return v;
  }
  if (NUMBER_COLUMNS.has(key) && (typeof v === "string" || typeof v === "bigint")) return Number(v);
  return v;
}

class NormalizePlugin implements KyselyPlugin {
  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return args.node;
  }
  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    const rows = args.result.rows.map((row) => {
      const out: UnknownRow = {};
      for (const [k, v] of Object.entries(row)) out[k] = normalizeValue(k, v);
      return out;
    });
    return { ...args.result, rows };
  }
}

// ---- Hilfen für Unterschiede zwischen den Datenbanken --------------------------

/** Zeile einfügen oder bei gleichem Schlüssel die übrigen Spalten überschreiben. */
export async function upsert<T extends keyof DB & string>(
  table: T,
  values: InsertObject<DB, T>,
  keys: (keyof DB[T] & string)[],
  executor: Kysely<DB> = db(),
) {
  const update = Object.fromEntries(Object.entries(values as Record<string, unknown>).filter(([k]) => !keys.includes(k as never)));
  const q = executor.insertInto(table).values(values);
  if (dialect() === "mysql") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (q as any).onDuplicateKeyUpdate(Object.keys(update).length ? update : { [keys[0]]: (values as Record<string, unknown>)[keys[0]] }).execute();
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (q as any).onConflict((oc: any) => (Object.keys(update).length ? oc.columns(keys).doUpdateSet(update) : oc.columns(keys).doNothing())).execute();
}

/** Anzahl Zeilen als Zahl (Postgres liefert count als Text). */
export const countAll = () => sql<number>`count(*)`.as("n");

type DbError = { code?: unknown; errno?: unknown; message?: unknown };

/** Eindeutigkeit verletzt (Name schon vergeben, Code-Kollision, …). */
export function isUniqueViolation(err: unknown): boolean {
  const e = (err ?? {}) as DbError;
  return e.code === "23505" || e.code === "ER_DUP_ENTRY" || e.errno === 1062 || e.code === "SQLITE_CONSTRAINT_UNIQUE" || e.code === "SQLITE_CONSTRAINT_PRIMARYKEY";
}

/** Fremdschlüssel verletzt (z. B. Film gehört nicht zur Runde). */
export function isForeignKeyViolation(err: unknown): boolean {
  const e = (err ?? {}) as DbError;
  return e.code === "23503" || e.code === "ER_NO_REFERENCED_ROW_2" || e.errno === 1452 || e.code === "SQLITE_CONSTRAINT_FOREIGNKEY";
}

/** Grenze aus einem alten Supabase-Trigger (Abspann voll, zu viele Bewertungen). */
export function isLimitViolation(err: unknown): boolean {
  return ((err ?? {}) as DbError).code === "P0001";
}
