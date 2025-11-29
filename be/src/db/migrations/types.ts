import { DatabaseAdapter } from '../types.js';

export interface Migration {
    name: string;
    up(db: DatabaseAdapter): Promise<void>;
    down(db: DatabaseAdapter): Promise<void>;
}
