import { Pool, PoolClient } from 'pg';
import { DatabaseAdapter, DatabaseClient } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * PostgreSQL database adapter
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
    private pool: Pool;

    constructor(config: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    }) {
        log.debug('Creating PostgreSQL connection pool', {
            host: config.host,
            port: config.port,
            database: config.database,
        });

        this.pool = new Pool({
            ...config,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            log.error('Unexpected error on idle PostgreSQL client', { error: err.message });
        });
    }

    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
        const result = await this.pool.query(text, params);
        return result.rows as T[];
    }

    async queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
        const rows = await this.query<T>(text, params);
        return rows[0];
    }

    async getClient(): Promise<DatabaseClient> {
        const client = await this.pool.connect();
        return {
            query: async <T>(text: string, params?: unknown[]) => {
                const result = await client.query(text, params);
                return result.rows as T[];
            },
            release: () => client.release(),
        };
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    async checkConnection(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            log.debug('PostgreSQL connection check successful');
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error('PostgreSQL connection check failed', { error: errorMessage });
            return false;
        }
    }
}
