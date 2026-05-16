import { Pool, QueryResult, QueryResultRow } from "pg";
import type { AppEnv } from "../config/env";
import { logger } from "../config/logger";

let pool: Pool | null = null;

export interface DatabaseConnection {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: any[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

export class DatabasePool implements DatabaseConnection {
  constructor(private innerPool: Pool) {}

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: any[]): Promise<QueryResult<T>> {
    return this.innerPool.query<T>(sql, values);
  }

  async close(): Promise<void> {
    await this.innerPool.end();
  }
}

export function initializeDatabase(env: AppEnv): DatabasePool {
  if (pool) {
    return new DatabasePool(pool);
  }

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    min: env.DATABASE_POOL_MIN,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  });

  pool.on("error", (err) => {
    logger.error("Unexpected error on idle client", {
      message: err.message,
      stack: err.stack,
    });
  });

  return new DatabasePool(pool);
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function getDatabase(): DatabasePool {
  if (!pool) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return new DatabasePool(pool);
}
