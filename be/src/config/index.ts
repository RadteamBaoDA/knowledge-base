import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Load SSL certificates if available
const certsDir = join(__dirname, '..', '..', '..', 'certs');
const sslKeyPath = join(certsDir, 'key.pem');
const sslCertPath = join(certsDir, 'cert.pem');

const hasSSLCerts = existsSync(sslKeyPath) && existsSync(sslCertPath);

const nodeEnv = process.env['NODE_ENV'] ?? 'development';
const isProduction = nodeEnv === 'production';

// Helper to get required env var in production
const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    if (isProduction) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return ''; // Return empty string in dev if not required
  }
  return value;
};

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv,
  isProduction,

  // HTTPS/SSL Configuration
  https: {
    enabled: process.env['HTTPS_ENABLED'] === 'true' && hasSSLCerts,
    keyPath: sslKeyPath,
    certPath: sslCertPath,
    // Load certs lazily to avoid errors if not present
    getCredentials: () => hasSSLCerts ? {
      key: readFileSync(sslKeyPath),
      cert: readFileSync(sslCertPath),
    } : null,
  },

  // Development domain configuration
  devDomain: process.env['DEV_DOMAIN'] ?? 'localhost',

  // Feature Flags
  enableRootLogin: process.env['ENABLE_ROOT_LOGIN'] === 'true',

  // Session Store Configuration
  sessionStore: {
    type: (process.env['SESSION_STORE'] ||
      (isProduction ? 'redis' : 'memory')) as 'redis' | 'memory',
  },

  // Database Configuration
  database: {
    type: (process.env['DATABASE_TYPE'] ||
      (isProduction ? 'postgresql' : 'sqlite')) as 'postgresql' | 'sqlite',

    // PostgreSQL config
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    name: process.env['DB_NAME'] ?? 'knowledge_base',
    user: process.env['DB_USER'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? '',

    // SQLite config
    sqlitePath: process.env['SQLITE_PATH'] ?? '.data/knowledge-base.db',
  },

  ragflow: {
    // Full chat iframe URL (direct URL, no proxy)
    aiChatUrl: process.env['RAGFLOW_AI_CHAT_URL'] ?? '',
    // Full search iframe URL (direct URL, no proxy)
    aiSearchUrl: process.env['RAGFLOW_AI_SEARCH_URL'] ?? '',

    // Dynamic sources configuration
    chatSources: [
      {
        id: 'default-chat',
        name: 'Default Chat',
        url: process.env['RAGFLOW_AI_CHAT_URL'] ?? '',
      },
      {
        id: 'chat1',
        name: 'Chat 1',
        url: process.env['RAGFLOW_AI_CHAT_URL'] ?? '',
      },
    ],
    searchSources: [
      {
        id: 'default-search',
        name: 'Default Search',
        url: process.env['RAGFLOW_AI_SEARCH_URL'] ?? '',
      },
      {
        id: 'search1',
        name: 'Search 1',
        url: process.env['RAGFLOW_AI_SEARCH_URL'] ?? '',
      },
    ],
  },

  langfuse: {
    secretKey: process.env['LANGFUSE_SECRET_KEY'] ?? '',
    publicKey: process.env['LANGFUSE_PUBLIC_KEY'] ?? '',
    baseUrl: process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com',
  },

  azureAd: {
    clientId: getEnv('AZURE_AD_CLIENT_ID', ''),
    clientSecret: getEnv('AZURE_AD_CLIENT_SECRET', ''),
    tenantId: getEnv('AZURE_AD_TENANT_ID', ''),
    redirectUri: process.env['AZURE_AD_REDIRECT_URI'] ?? 'http://localhost:3001/api/auth/callback',
  },

  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    db: parseInt(process.env['REDIS_DB'] ?? '0', 10),
    // Build Redis URL for client
    get url(): string {
      const password = process.env['REDIS_PASSWORD'];
      const host = process.env['REDIS_HOST'] ?? 'localhost';
      const port = process.env['REDIS_PORT'] ?? '6379';
      const db = process.env['REDIS_DB'] ?? '0';
      return password
        ? `redis://:${password}@${host}:${port}/${db}`
        : `redis://${host}:${port}/${db}`;
    },
  },

  session: {
    secret: getEnv('SESSION_SECRET', isProduction ? undefined : 'change-me-in-production'),
    // Session TTL: 7 days in seconds
    ttlSeconds: parseInt(process.env['SESSION_TTL_DAYS'] ?? '7', 10) * 24 * 60 * 60,
  },

  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',

  // Shared storage domain (for cross-subdomain user info sharing)
  sharedStorageDomain: process.env['SHARED_STORAGE_DOMAIN'] ?? '.localhost',
} as const;

export type Config = typeof config;

