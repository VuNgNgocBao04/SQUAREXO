import { Pool, QueryResult, QueryResultRow } from "pg";
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

export type DatabaseConfig = {
  connectionString: string;
  poolMin?: number;
  poolMax?: number;
  statementTimeoutMs?: number;
};

export function initializeDatabase(config: DatabaseConfig): DatabasePool {
  if (pool) {
    return new DatabasePool(pool);
  }

  pool = new Pool({
    connectionString: config.connectionString,
    max: config.poolMax ?? 10,
    min: config.poolMin ?? 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: config.statementTimeoutMs ?? 30000,
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
