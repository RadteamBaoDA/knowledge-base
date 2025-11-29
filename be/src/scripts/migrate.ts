import { getAdapter, closePool } from '../db/index.js';
import { runMigrations } from '../db/migrations/runner.js';
import { log } from '../services/logger.service.js';

async function main() {
  try {
    log.info('Starting manual migration...');
    const db = await getAdapter();
    await runMigrations(db);
    log.info('Manual migration completed successfully');
    await closePool();
    process.exit(0);
  } catch (error) {
    log.error('Manual migration failed', { error });
    await closePool();
    process.exit(1);
  }
}

main();
