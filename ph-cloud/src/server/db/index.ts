import "server-only";
import { connect, type Connection, type DB, type DbKind } from "./connect";

export * as schema from "./schema";
export type { DB, DbKind };

const g = globalThis as unknown as { __phcDb?: Promise<Connection> };

function connection(): Promise<Connection> {
  if (!g.__phcDb) {
    g.__phcDb = connect().catch((err) => {
      g.__phcDb = undefined; // permite nova tentativa na próxima requisição
      throw err;
    });
  }
  return g.__phcDb;
}

export async function getDb(): Promise<DB> {
  return (await connection()).db;
}

export async function getDbKind(): Promise<DbKind> {
  return (await connection()).kind;
}
