/**
 * Service for persisting user preferences to IndexedDB
 * Scoped by userId to support multiple users on the same device
 */

const DB_NAME = 'kb-preferences';
const DB_VERSION = 1;
const STORE_NAME = 'user_settings';

interface UserSetting {
    userId: string;
    key: string;
    value: any;
    updatedAt: number;
}

class UserPreferencesService {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Create object store with composite key [userId, key]
                    db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'key'] });
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
                reject((event.target as IDBOpenDBRequest).error);
            };
        });

        return this.dbPromise;
    }

    /**
     * Get a setting for a specific user
     */
    async get<T>(userId: string, key: string, defaultValue?: T): Promise<T | undefined> {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get([userId, key]);

                request.onsuccess = () => {
                    const result = request.result as UserSetting | undefined;
                    resolve(result ? result.value : defaultValue);
                };

                request.onerror = () => {
                    console.error(`Failed to get setting ${key} for user ${userId}`);
                    resolve(defaultValue);
                };
            });
        } catch (error) {
            console.error('Error accessing IndexedDB:', error);
            return defaultValue;
        }
    }

    /**
     * Save a setting for a specific user
     */
    async set(userId: string, key: string, value: any): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const setting: UserSetting = {
                    userId,
                    key,
                    value,
                    updatedAt: Date.now(),
                };

                const request = store.put(setting);

                request.onsuccess = () => resolve();
                request.onerror = (event) => {
                    console.error(`Failed to save setting ${key} for user ${userId}`, (event.target as IDBOpenDBRequest).error);
                    resolve(); // Resolve anyway to prevent hanging
                };
            });
        } catch (error) {
            console.error('Error accessing IndexedDB:', error);
        }
    }
}

export const userPreferences = new UserPreferencesService();
