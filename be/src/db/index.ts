import { Pool, PoolClient } from 'pg';
import { config } from '../config/index.js';
import { log } from '../services/logger.service.js';

let pool: Pool | null = null;

/**
 * Get the PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    log.debug('Creating PostgreSQL connection pool', {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
    });
    
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      log.error('Unexpected error on idle PostgreSQL client', { error: err.message });
    });
  }
  return pool;
}

/**
 * Execute a query with automatic client release
 */
export async function query<T>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Execute a single query and return first row
 */
export async function queryOne<T>(
  text: string,
  params?: unknown[]
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/**
 * Get a client for transaction support
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

/**
 * Close the database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Check database connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    log.debug('Database connection check successful');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Database connection check failed', { error: errorMessage });
    return false;
  }
}
