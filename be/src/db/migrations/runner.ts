import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';
import { migration as migration001 } from './001_initial_schema.js';
import { migration as migration002 } from './002_rbac_update.js';
import { migration as migration003 } from './003_add_user_details.js';

const migrations = [
  migration001,
  migration002,
  migration003,
];

export async function runMigrations(db: DatabaseAdapter): Promise<void> {
  log.info('Checking for pending migrations...');

  // Ensure migrations table exists
  const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

  if (isPostgres) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  } else {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  // Get executed migrations
  const executedMigrations = await db.query<{ name: string }>('SELECT name FROM migrations');
  const executedNames = new Set(executedMigrations.map(m => m.name));

  for (const migration of migrations) {
    if (!executedNames.has(migration.name)) {
      log.info(`Applying migration: ${migration.name}`);
      try {
        await migration.up(db);
        await db.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        log.info(`Migration applied: ${migration.name}`);
      } catch (error) {
        log.error(`Migration failed: ${migration.name}`, { error });
        throw error; // Stop migration process on failure
      }
    } else {
      log.debug(`Migration already applied: ${migration.name}`);
    }
  }

  log.info('All migrations checked/applied');
}
