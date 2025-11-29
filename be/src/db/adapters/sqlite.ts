import Database from 'better-sqlite3';
import { DatabaseAdapter, DatabaseClient } from '../types.js';
import { log } from '../../services/logger.service.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * SQLite database adapter
 */
export class SQLiteAdapter implements DatabaseAdapter {
    private db: Database.Database;
    private path: string;

    constructor(path: string) {
        this.path = path;

        // Ensure directory exists
        const dir = dirname(path);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        log.debug('Creating SQLite database', { path });
        this.db = new Database(path);

        // Enable foreign keys
        this.db.pragma('foreign_keys = ON');
    }

    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
        try {
            // Convert PostgreSQL syntax to SQLite
            const sqliteQuery = this.convertQuery(text);
            const stmt = this.db.prepare(sqliteQuery);

            if (stmt.reader) {
                if (params && params.length > 0) {
                    return stmt.all(...params) as T[];
                } else {
                    return stmt.all() as T[];
                }
            } else {
                if (params && params.length > 0) {
                    stmt.run(...params);
                } else {
                    stmt.run();
                }
                return [] as T[];
            }
        } catch (error) {
            log.error('SQLite query error', {
                query: text,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    async queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
        const rows = await this.query<T>(text, params);
        return rows[0];
    }

    async getClient(): Promise<DatabaseClient> {
        // SQLite doesn't have connection pooling, return a mock client
        return {
            query: async <T>(text: string, params?: unknown[]) => {
                return this.query<T>(text, params);
            },
            release: () => {
                // No-op for SQLite
            },
        };
    }

    async close(): Promise<void> {
        this.db.close();
        log.debug('SQLite database closed');
    }

    async checkConnection(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            log.debug('SQLite connection check successful');
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error('SQLite connection check failed', { error: errorMessage });
            return false;
        }
    }

    /**
     * Convert PostgreSQL query syntax to SQLite
     */
    private convertQuery(pgQuery: string): string {
        let query = pgQuery;

        // Convert $1, $2, etc. to ? placeholders
        query = query.replace(/\$\d+/g, '?');

        // Convert RETURNING * to nothing (SQLite doesn't support RETURNING)
        query = query.replace(/RETURNING \*/gi, '');

        // Convert NOW() to datetime('now')
        query = query.replace(/NOW\(\)/gi, "datetime('now')");

        // Convert ILIKE to LIKE (case-insensitive in SQLite by default)
        query = query.replace(/ILIKE/gi, 'LIKE');

        return query;
    }
}
