import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
  name: '004_create_minio_buckets',
  async up(db: DatabaseAdapter): Promise<void> {
    log.info('Running migration: 004_create_minio_buckets');

    const isPostgres = db.constructor.name === 'PostgreSQLAdapter';

    if (isPostgres) {
      await db.query(`
                CREATE TABLE IF NOT EXISTS minio_buckets (
                    id TEXT PRIMARY KEY,
                    bucket_name TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    description TEXT,
                    created_by TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_active INTEGER DEFAULT 1,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `);
    } else {
      await db.query(`
                CREATE TABLE IF NOT EXISTS minio_buckets (
                    id TEXT PRIMARY KEY,
                    bucket_name TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    description TEXT,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    is_active INTEGER DEFAULT 1,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `);
    }

    log.info('Created minio_buckets table');
  },

  async down(db: DatabaseAdapter): Promise<void> {
    log.info('Reverting migration: 004_create_minio_buckets');
    await db.query('DROP TABLE IF EXISTS minio_buckets');
    log.info('Dropped minio_buckets table');
  }
};
