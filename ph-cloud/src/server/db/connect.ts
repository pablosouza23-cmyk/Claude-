import path from "node:path";
import { mkdirSync } from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/*
 * Conexão com o banco. Com DATABASE_URL usa PostgreSQL (node-postgres).
 * Sem DATABASE_URL usa PGlite (PostgreSQL embutido, gravado em disco) — serve para desenvolvimento
 * e para um único servidor; não serve para hospedagens serverless, onde o disco não persiste.
 */

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbKind = "postgres" | "pglite";

export type Connection = { db: DB; kind: DbKind; close: () => Promise<void> };

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
// Número fixo usado no pg_advisory_lock para que só uma instância rode migrações por vez.
const MIGRATION_LOCK_ID = 74_277_001;

/** Fecha o PGlite de forma limpa ao encerrar o processo (encerramento à força pode corromper os arquivos). */
function closeOnExit(close: () => Promise<void>) {
  let closing = false;
  const handler = (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    close()
      .catch(() => {})
      .finally(() => process.kill(process.pid, signal));
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
}

export async function connect(opts: { migrate?: boolean } = {}): Promise<Connection> {
  const url = process.env.DATABASE_URL?.trim();
  const migrate = opts.migrate ?? process.env.DB_AUTO_MIGRATE !== "false";

  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX ?? 5),
      ssl: /sslmode=(require|verify)/.test(url) ? { rejectUnauthorized: !/sslmode=require/.test(url) } : undefined,
    });
    if (migrate) {
      const { migrate: runMigrations } = await import("drizzle-orm/node-postgres/migrator");
      const client = await pool.connect();
      try {
        await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
        await runMigrations(drizzle(client, { schema }), { migrationsFolder: MIGRATIONS_FOLDER });
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
        client.release();
      }
    }
    return { db: drizzle(pool, { schema }) as unknown as DB, kind: "postgres", close: () => pool.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR || ".data/pglite";
  const isMemory = dataDir.startsWith("memory://");
  // Caminho definido em tempo de execução: não deve entrar no rastreamento de arquivos do build.
  const dir = isMemory ? dataDir : path.resolve(/*turbopackIgnore: true*/ dataDir);
  if (!isMemory) mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const client = new PGlite(dir);
  try {
    await client.waitReady;
  } catch (err) {
    throw new Error(
      `Não foi possível abrir o banco embutido em "${dataDir}" (${(err as Error).message}). ` +
        "Se o servidor foi encerrado à força, os arquivos podem ter sido corrompidos: restaure um backup ou apague a pasta para começar do zero. " +
        "Em produção, use PostgreSQL (DATABASE_URL).",
    );
  }
  closeOnExit(() => client.close());
  const db = drizzle(client, { schema });
  if (migrate) {
    const { migrate: runMigrations } = await import("drizzle-orm/pglite/migrator");
    await runMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
  return { db: db as unknown as DB, kind: "pglite", close: () => client.close() };
}
