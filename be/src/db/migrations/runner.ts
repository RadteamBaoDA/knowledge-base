/**
 * @fileoverview Database migration runner.
 * 
 * This module handles the execution of database migrations in order.
 * It tracks which migrations have been applied and only runs pending ones.
 * 
 * Migration features:
 * - Automatic migrations table creation
 * - Idempotent execution (safe to run multiple times)
 * - Ordered execution based on migration name prefixes (001_, 002_, etc.)
 * - Support for both PostgreSQL and SQLite databases
 * - Failure stops migration process to prevent partial state
 * 
 * @module db/migrations/runner
 */

import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';
import { migration as migration001 } from './001_initial_schema.js';
import { migration as migration002 } from './002_rbac_update.js';
import { migration as migration003 } from './003_add_user_details.js';
import { migration as migration004 } from './004_create_minio_buckets.js';

/**
 * Ordered list of all migrations.
 * Migrations are executed in array order (which should match numerical prefixes).
 * 
 * To add a new migration:
 * 1. Create a new file: 005_your_migration.ts
 * 2. Import it here: import { migration as migration005 } from './005_your_migration.js';
 * 3. Add to this array: migration005
 */
const migrations = [
  migration001,  // Initial schema: users, chat_sessions, chat_messages
  migration002,  // RBAC update: role and permissions columns
  migration003,  // User details: department, job_title, mobile_phone
  migration004,  // MinIO buckets table
];

/**
 * Run all pending database migrations.
 * 
 * This function:
 * 1. Creates the migrations tracking table if it doesn't exist
 * 2. Queries for already-executed migrations
 * 3. Runs each pending migration in order
 * 4. Records successful migrations in the tracking table
 * 
 * @param db - Database adapter instance
 * @throws Error if any migration fails (stops execution)
 * 
 * @example
 * const db = await getAdapter();
 * await runMigrations(db);
 */
export async function runMigrations(db: DatabaseAdapter): Promise<void> {
  log.info('Checking for pending migrations...');

  // Create migrations tracking table (database-specific syntax)
  const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

  // PostgreSQL uses SERIAL for auto-increment, SQLite uses INTEGER PRIMARY KEY AUTOINCREMENT
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

  // Get list of already-executed migrations
  const executedMigrations = await db.query<{ name: string }>('SELECT name FROM migrations');
  const executedNames = new Set(executedMigrations.map(m => m.name));

  // Execute each pending migration
  for (const migration of migrations) {
    if (!executedNames.has(migration.name)) {
      log.info(`Applying migration: ${migration.name}`);
      try {
        // Execute the migration's up() function
        await migration.up(db);
        
        // Record successful migration
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
