/**
 * @fileoverview RBAC (Role-Based Access Control) update migration.
 * 
 * This migration adds role and permissions columns to the users table
 * if they don't already exist. This handles the case where the initial
 * schema might have been created without these columns.
 * 
 * @module db/migrations/002_rbac_update
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * RBAC update migration.
 * Ensures users table has role and permissions columns.
 */
export const migration: Migration = {
    name: '002_rbac_update',
    
    /**
     * Apply migration: Add role and permissions columns to users table.
     * 
     * PostgreSQL supports ALTER TABLE ADD COLUMN IF NOT EXISTS.
     * SQLite requires checking column existence before adding.
     */
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 002_rbac_update');

        const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

        if (isPostgres) {
            // PostgreSQL: Use IF NOT EXISTS clause (PostgreSQL 9.6+)
            await db.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS permissions TEXT NOT NULL DEFAULT '[]'
      `);
        } else {
            // SQLite: Check column existence via PRAGMA table_info
            // SQLite doesn't support IF NOT EXISTS for ADD COLUMN
            try {
                // Query table schema to check existing columns
                const userColumns = await db.query<{ name: string }>("PRAGMA table_info(users)");
                const hasRole = userColumns.some(col => col.name === 'role');
                const hasPermissions = userColumns.some(col => col.name === 'permissions');

                // Add missing columns
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

    /**
     * Reverse migration: Remove role and permissions columns.
     * 
     * Note: SQLite doesn't fully support DROP COLUMN in older versions.
     * This may fail on some SQLite versions but we attempt it anyway.
     */
    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 002_rbac_update');
        
        const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

        if (isPostgres) {
            // PostgreSQL supports DROP COLUMN IF EXISTS
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS role');
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS permissions');
        } else {
            // SQLite: Attempt DROP COLUMN (supported in SQLite 3.35.0+)
            try {
                await db.query('ALTER TABLE users DROP COLUMN role');
                await db.query('ALTER TABLE users DROP COLUMN permissions');
            } catch (error) {
                log.warn('Failed to drop columns in SQLite (might not be supported)', { error });
            }
        }
    }
};
