import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
    name: '001_initial_schema',
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 001_initial_schema');

        // Create users table
        // Note: We use raw SQL that is compatible with both SQLite and PostgreSQL where possible,
        // or handle differences if needed. For these basic tables, standard SQL works well enough
        // with the exception of specific types like DATETIME vs TIMESTAMP which our adapters might need to handle
        // or we use text for SQLite compatibility if we want strictly shared SQL.
        // However, since we are using raw queries passed to adapters, we might need to be careful.
        // The previous implementation used adapter-specific SQL in initializeTables.
        // To keep it simple and robust, we will use the same SQL that was working, but we need to know which DB we are running on
        // OR use a syntax compatible with both.

        // SQLite and Postgres have different syntax for timestamps and some types.
        // Ideally we would inspect db type, but DatabaseAdapter doesn't expose it directly yet.
        // For now, we'll use a generic approach or try to detect.
        // Actually, the previous implementation had separate SQL for SQLite and Postgres.
        // We should probably check the adapter type or use "safe" SQL.

        // Let's check if we can execute generic SQL.
        // SQLite: TEXT for everything usually works.
        // Postgres: Needs specific types.

        // Strategy: We will try to execute SQL that works for both, or check config.
        // Since we don't have easy access to config here without importing it (which is fine),
        // let's import config to check DB type if needed, OR just use "IF NOT EXISTS" which both support.

        // Users Table
        // SQLite uses TEXT for timestamps usually. Postgres uses TIMESTAMP WITH TIME ZONE.
        // We can try to use a common ground or conditional logic.
        // But wait, the previous SQLite adapter used `datetime('now')` and Postgres used `NOW()`.

        // To solve this properly without over-engineering a query builder:
        // We will define the queries for both and pick one based on the adapter class name or a property.
        // Let's assume we can check `db.constructor.name`.

        const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

        if (isPostgres) {
            await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          permissions TEXT NOT NULL DEFAULT '[]',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

            await db.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

            await db.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )
      `);
        } else {
            // SQLite
            // Note: SQLiteAdapter.query uses db.exec/prepare.
            await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          permissions TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

            await db.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

            await db.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )
      `);
        }
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 001_initial_schema');
        await db.query('DROP TABLE IF EXISTS chat_messages');
        await db.query('DROP TABLE IF EXISTS chat_sessions');
        await db.query('DROP TABLE IF EXISTS users');
    }
};
