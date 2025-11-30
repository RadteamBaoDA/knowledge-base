/**
 * @fileoverview SQLite database adapter implementation.
 * 
 * This module provides a SQLite-specific implementation of the DatabaseAdapter interface.
 * It uses the 'better-sqlite3' library for synchronous, high-performance SQLite operations.
 * 
 * Features:
 * - Automatic PostgreSQL-to-SQLite syntax conversion
 * - File-based database with auto-directory creation
 * - Foreign key constraint enforcement
 * - Development-friendly with zero configuration
 * 
 * Note: SQLite is intended for development/testing. Use PostgreSQL for production.
 * 
 * @module db/adapters/sqlite
 */

import Database from 'better-sqlite3';
import { DatabaseAdapter, DatabaseClient } from '../types.js';
import { log } from '../../services/logger.service.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * SQLite database adapter.
 * Implements the DatabaseAdapter interface for SQLite databases.
 * 
 * Includes automatic SQL syntax conversion from PostgreSQL:
 * - $1, $2 placeholders → ? placeholders
 * - NOW() → datetime('now')
 * - ILIKE → LIKE (SQLite is case-insensitive by default)
 * - RETURNING * → removed (not supported)
 * 
 * @implements {DatabaseAdapter}
 * 
 * @example
 * const adapter = new SQLiteAdapter('.data/app.db');
 * const users = await adapter.query<User>('SELECT * FROM users WHERE id = $1', [1]);
 */
export class SQLiteAdapter implements DatabaseAdapter {
    /** better-sqlite3 Database instance */
    private db: Database.Database;
    /** Path to the SQLite database file */
    private path: string;

    /**
     * Creates a new SQLite adapter.
     * Automatically creates the database directory and file if they don't exist.
     * 
     * @param path - Path to the SQLite database file
     */
    constructor(path: string) {
        this.path = path;

        // Create database directory if it doesn't exist
        const dir = dirname(path);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        log.debug('Creating SQLite database', { path });
        this.db = new Database(path);

        // Enable foreign key constraint enforcement (disabled by default in SQLite)
        this.db.pragma('foreign_keys = ON');
    }

    /**
     * Execute a query and return all matching rows.
     * Automatically converts PostgreSQL syntax to SQLite syntax.
     * 
     * @template T - Expected row type
     * @param text - SQL query (PostgreSQL or SQLite syntax)
     * @param params - Parameter values for placeholders
     * @returns Array of result rows
     * @throws Error if query execution fails
     */
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
        try {
            // Convert PostgreSQL-style query to SQLite-compatible syntax
            const sqliteQuery = this.convertQuery(text);
            const stmt = this.db.prepare(sqliteQuery);

            // Determine if this is a SELECT (reader) or INSERT/UPDATE/DELETE query
            if (stmt.reader) {
                // SELECT query - return result rows
                if (params && params.length > 0) {
                    return stmt.all(...params) as T[];
                } else {
                    return stmt.all() as T[];
                }
            } else {
                // INSERT/UPDATE/DELETE - execute and return empty array
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

    /**
     * Execute a query and return only the first row.
     * 
     * @template T - Expected row type
     * @param text - SQL query
     * @param params - Parameter values
     * @returns First row or undefined
     */
    async queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
        const rows = await this.query<T>(text, params);
        return rows[0];
    }

    /**
     * Get a mock client for transaction support.
     * SQLite doesn't have connection pooling, so this returns a wrapper
     * around the same database instance.
     * 
     * @returns Database client wrapper
     */
    async getClient(): Promise<DatabaseClient> {
        // SQLite doesn't have connection pooling, return a mock client
        return {
            query: async <T>(text: string, params?: unknown[]) => {
                return this.query<T>(text, params);
            },
            release: () => {
                // No-op for SQLite - no pool to release to
            },
        };
    }

    /**
     * Close the SQLite database connection.
     * Releases file locks and flushes pending writes.
     */
    async close(): Promise<void> {
        this.db.close();
        log.debug('SQLite database closed');
    }

    /**
     * Verify database connectivity.
     * 
     * @returns True if database is accessible
     */
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
     * Convert PostgreSQL query syntax to SQLite-compatible syntax.
     * 
     * Conversions performed:
     * - $1, $2, $3 → ? (positional parameters)
     * - RETURNING * → removed (SQLite doesn't support RETURNING)
     * - NOW() → datetime('now') (current timestamp)
     * - ILIKE → LIKE (SQLite LIKE is case-insensitive)
     * 
     * @param pgQuery - PostgreSQL-style SQL query
     * @returns SQLite-compatible SQL query
     */
    private convertQuery(pgQuery: string): string {
        let query = pgQuery;

        // Convert $1, $2, etc. to ? placeholders
        query = query.replace(/\$\d+/g, '?');

        // Remove RETURNING clause (SQLite doesn't support it)
        query = query.replace(/RETURNING \*/gi, '');

        // Convert NOW() to SQLite datetime function
        query = query.replace(/NOW\(\)/gi, "datetime('now')");

        // Convert ILIKE to LIKE (SQLite LIKE is case-insensitive by default)
        query = query.replace(/ILIKE/gi, 'LIKE');

        return query;
    }
}
