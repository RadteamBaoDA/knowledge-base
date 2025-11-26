import { getPool, closePool } from './index.js';

const migrations = [
  {
    name: '001_create_chat_sessions',
    up: `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL DEFAULT 'New Chat',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_search ON chat_sessions USING gin(to_tsvector('english', title));
    `,
  },
  {
    name: '002_create_chat_messages',
    up: `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_content_search ON chat_messages USING gin(to_tsvector('english', content));
    `,
  },
  {
    name: '003_create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
  },
];

async function runMigrations(): Promise<void> {
  const pool = getPool();
  
  console.log('🔄 Running database migrations...');
  
  // First, ensure migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  
  for (const migration of migrations) {
    // Check if migration has been executed
    const result = await pool.query(
      'SELECT name FROM migrations WHERE name = $1',
      [migration.name]
    );
    
    if (result.rows.length === 0) {
      console.log(`  ⏳ Running migration: ${migration.name}`);
      
      try {
        await pool.query(migration.up);
        await pool.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        console.log(`  ✅ Completed: ${migration.name}`);
      } catch (error) {
        console.error(`  ❌ Failed: ${migration.name}`, error);
        throw error;
      }
    } else {
      console.log(`  ⏭️  Skipping: ${migration.name} (already executed)`);
    }
  }
  
  console.log('✅ All migrations completed!');
}

// Run migrations if executed directly
runMigrations()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
