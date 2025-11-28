/**
 * Database adapter interface for supporting multiple database backends
 */
export interface DatabaseAdapter {
    query<T>(text: string, params?: unknown[]): Promise<T[]>;
    queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined>;
    getClient(): Promise<DatabaseClient>;
    close(): Promise<void>;
    checkConnection(): Promise<boolean>;
}

/**
 * Database client interface for transaction support
 */
export interface DatabaseClient {
    query<T>(text: string, params?: unknown[]): Promise<T[]>;
    release(): void;
}
