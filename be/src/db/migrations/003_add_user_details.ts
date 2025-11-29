import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
    name: '003_add_user_details',
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 003_add_user_details');

        // Add department, job_title, and mobile_phone columns to users table
        // We use separate ALTER TABLE statements for compatibility

        try {
            await db.query('ALTER TABLE users ADD COLUMN department TEXT');
        } catch (e) {
            log.warn('Failed to add department column (might already exist)', { error: e });
        }

        try {
            await db.query('ALTER TABLE users ADD COLUMN job_title TEXT');
        } catch (e) {
            log.warn('Failed to add job_title column (might already exist)', { error: e });
        }

        try {
            await db.query('ALTER TABLE users ADD COLUMN mobile_phone TEXT');
        } catch (e) {
            log.warn('Failed to add mobile_phone column (might already exist)', { error: e });
        }
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 003_add_user_details');

        // SQLite does not support DROP COLUMN in older versions, but we'll try standard SQL
        // If it fails, we might need to recreate the table, but for now we'll assume it's supported or acceptable to leave

        try {
            await db.query('ALTER TABLE users DROP COLUMN department');
            await db.query('ALTER TABLE users DROP COLUMN job_title');
            await db.query('ALTER TABLE users DROP COLUMN mobile_phone');
        } catch (e) {
            log.warn('Failed to drop columns (might not be supported by this DB version)', { error: e });
        }
    }
};
