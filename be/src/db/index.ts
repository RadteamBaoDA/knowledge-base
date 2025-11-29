import { config } from '../config/index.js';
import { PostgreSQLAdapter } from './adapters/postgresql.js';
import { SQLiteAdapter } from './adapters/sqlite.js';
import { DatabaseAdapter } from './types.js';
import { log } from '../services/logger.service.js';

let adapter: DatabaseAdapter | null = null;

/**
 * Initialize database adapter based on configuration
 */
async function initializeAdapter(): Promise<DatabaseAdapter> {
  if (adapter) return adapter;

  if (config.database.type === 'postgresql') {
    try {
      const pgAdapter = new PostgreSQLAdapter({
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
      });

      const connected = await pgAdapter.checkConnection();
      if (!connected) {
        throw new Error('PostgreSQL connection check failed');
      }

      adapter = pgAdapter;
      log.info('Database: PostgreSQL', { host: config.database.host, database: config.database.name });
      return adapter;
    } catch (err) {
      log.warn('PostgreSQL unavailable, falling back to SQLite', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to SQLite
    }
  }

  // Use SQLite (either configured or as fallback)
  adapter = new SQLiteAdapter(config.database.sqlitePath);
  log.info('Database: SQLite', { path: config.database.sqlitePath });
  return adapter;
}

/**
 * Get the database adapter (lazy initialization)
 */
export async function getAdapter(): Promise<DatabaseAdapter> {
  if (!adapter) {
    return await initializeAdapter();
  }
  return adapter;
}

/**
 * Execute a query with automatic client release
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const db = await getAdapter();
  return db.query<T>(text, params);
}

/**
 * Execute a single query and return first row
 */
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
  const db = await getAdapter();
  return db.queryOne<T>(text, params);
}

/**
 * Get a client for transaction support
 */
export async function getClient() {
  const db = await getAdapter();
  return db.getClient();
}

/**
 * Close the database connection pool
 */
export async function closePool(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}

/**
 * Check database connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const db = await getAdapter();
    return await db.checkConnection();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Database connection check failed', { error: errorMessage });
    return false;
  }
}

// Backward compatibility exports
export function getPool() {
  log.warn('getPool() is deprecated, database now uses adapter pattern');
  return null;
}
