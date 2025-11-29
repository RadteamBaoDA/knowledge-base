import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
    name: '002_rbac_update',
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 002_rbac_update');

        const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

        if (isPostgres) {
            await db.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS permissions TEXT NOT NULL DEFAULT '[]'
      `);
        } else {
            // SQLite
            // SQLite doesn't support IF NOT EXISTS in ADD COLUMN in older versions, 
            // but we can check if column exists first or just try-catch.
            // However, since we are moving logic from adapter where we did check, let's try to be safe.
            // But wait, the adapter logic I wrote previously used `pragma table_info`.
            // We can't easily do that via generic `query` interface returning T[].
            // Actually we can, if we cast the result.

            try {
                // We'll try to add them. If they exist, it might fail or we can check first.
                // Let's try to check first to avoid errors.
                const userColumns = await db.query<{ name: string }>("PRAGMA table_info(users)");
                const hasRole = userColumns.some(col => col.name === 'role');
                const hasPermissions = userColumns.some(col => col.name === 'permissions');

                if (!hasRole) {
                    await db.query("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
                }
                if (!hasPermissions) {
                    await db.query("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]'");
                }
            } catch (error) {
                log.warn('Error applying SQLite RBAC migration (columns might already exist)', { error });
            }
        }
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 002_rbac_update');
        // SQLite doesn't support DROP COLUMN in older versions easily, but we can try.
        // Postgres does.
        const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

        if (isPostgres) {
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS role');
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS permissions');
        } else {
            try {
                await db.query('ALTER TABLE users DROP COLUMN role');
                await db.query('ALTER TABLE users DROP COLUMN permissions');
            } catch (error) {
                log.warn('Failed to drop columns in SQLite (might not be supported)', { error });
            }
        }
    }
};
