/**
 * @fileoverview Centralized configuration module for the Knowledge Base backend.
 * 
 * This module provides type-safe access to all application configuration values.
 * Configuration is loaded from environment variables with sensible defaults.
 * 
 * Key features:
 * - All environment variables accessed through the `config` object (never raw process.env)
 * - Production-mode validation for required secrets
 * - Lazy-loading of SSL certificates to avoid startup errors
 * - Type safety with TypeScript's `as const` assertion
 * 
 * @module config
 * @example
 * import { config } from './config/index.js';
 * console.log(config.port); // 3001
 * console.log(config.database.type); // 'postgresql' or 'sqlite'
 */

import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from '../services/logger.service.js';

/** ESM-compatible __filename resolution */
const __filename = fileURLToPath(import.meta.url);
/** ESM-compatible __dirname resolution */
const __dirname = dirname(__filename);

/** Load environment variables from .env file */
dotenv.config();

// ============================================================================
// SSL CERTIFICATE CONFIGURATION
// ============================================================================

/** Path to SSL certificates directory (relative to project root) */
const certsDir = join(__dirname, '..', '..', '..', 'certs');
/** Path to SSL private key file */
const sslKeyPath = join(certsDir, 'key.pem');
/** Path to SSL certificate file */
const sslCertPath = join(certsDir, 'cert.pem');

/** Whether SSL certificates exist and can be loaded */
const hasSSLCerts = existsSync(sslKeyPath) && existsSync(sslCertPath);

/** Current Node.js environment (development/production/test) */
const nodeEnv = process.env['NODE_ENV'] ?? 'development';
/** Whether running in production mode */
const isProduction = nodeEnv === 'production';

// ============================================================================
// ENVIRONMENT VARIABLE HELPERS
// ============================================================================

/**
 * Safely retrieves an environment variable with production validation.
 * 
 * @param key - The environment variable name to retrieve
 * @param defaultValue - Optional default value if not set
 * @returns The environment variable value, default value, or empty string
 * @throws Error in production if required variable is missing (no default provided)
 * 
 * @example
 * // Required in production, optional in development
 * const secret = getEnv('API_SECRET');
 * 
 * // With default value (never throws)
 * const port = getEnv('PORT', '3001');
 */
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

// ============================================================================
// MAIN CONFIGURATION OBJECT
// ============================================================================

/**
 * Application configuration object.
 * Provides centralized, type-safe access to all configuration values.
 * 
 * @remarks
 * This object is frozen with `as const` to ensure immutability.
 * Access environment variables through this object instead of process.env directly.
 * 
 * @property {number} port - Server listening port (default: 3001)
 * @property {string} nodeEnv - Current environment (development/production/test)
 * @property {boolean} isProduction - Quick check for production mode
 * @property {object} https - HTTPS/SSL configuration
 * @property {object} database - Database connection settings
 * @property {object} ragflow - RAGFlow iframe URLs and sources
 * @property {object} langfuse - Langfuse observability configuration
 * @property {object} azureAd - Azure Entra ID OAuth settings
 * @property {object} redis - Redis connection settings
 * @property {object} session - Session management settings
 */
export const config = {
  /** Server port number */
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  /** Current Node environment */
  nodeEnv,
  /** Production mode flag */
  isProduction,

  // --------------------------------------------------------------------------
  // HTTPS/SSL Configuration
  // --------------------------------------------------------------------------
  
  /**
   * HTTPS configuration settings.
   * Enables secure connections when SSL certificates are available.
   */
  https: {
    /** Whether HTTPS is enabled (requires certificates) */
    enabled: process.env['HTTPS_ENABLED'] === 'true' && hasSSLCerts,
    /** Path to SSL private key file */
    keyPath: sslKeyPath,
    /** Path to SSL certificate file */
    certPath: sslCertPath,
    /**
     * Lazily loads SSL credentials.
     * Returns null if certificates don't exist.
     * @returns SSL key/cert pair or null
     */
    getCredentials: () => hasSSLCerts ? {
      key: readFileSync(sslKeyPath),
      cert: readFileSync(sslCertPath),
    } : null,
  },

  // --------------------------------------------------------------------------
  // Development Configuration
  // --------------------------------------------------------------------------
  
  /** Development domain for local URLs (default: localhost) */
  devDomain: process.env['DEV_DOMAIN'] ?? 'localhost',

  // --------------------------------------------------------------------------
  // Feature Flags
  // --------------------------------------------------------------------------
  
  /** Enable root user login (username/password auth) */
  enableRootLogin: process.env['ENABLE_ROOT_LOGIN'] === 'true',

  // --------------------------------------------------------------------------
  // Session Store Configuration
  // --------------------------------------------------------------------------
  
  /**
   * Session storage configuration.
   * Uses Redis in production for persistence, memory in development.
   */
  sessionStore: {
    /** Session store type: 'redis' for production, 'memory' for development */
    type: (process.env['SESSION_STORE'] ||
      (isProduction ? 'redis' : 'memory')) as 'redis' | 'memory',
  },

  // --------------------------------------------------------------------------
  // Database Configuration
  // --------------------------------------------------------------------------
  
  /**
   * Database connection configuration.
   * Supports PostgreSQL (production) and SQLite (development/fallback).
   */
  database: {
    /** Database type: 'postgresql' for production, 'sqlite' for development */
    type: (process.env['DATABASE_TYPE'] ||
      (isProduction ? 'postgresql' : 'sqlite')) as 'postgresql' | 'sqlite',

    // PostgreSQL connection settings
    /** PostgreSQL host address */
    host: process.env['DB_HOST'] ?? 'localhost',
    /** PostgreSQL port number */
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    /** PostgreSQL database name */
    name: process.env['DB_NAME'] ?? 'knowledge_base',
    /** PostgreSQL username */
    user: process.env['DB_USER'] ?? 'postgres',
    /** PostgreSQL password */
    password: process.env['DB_PASSWORD'] ?? '',

    // SQLite configuration
    /** SQLite database file path */
    sqlitePath: process.env['SQLITE_PATH'] ?? '.data/knowledge-base.db',
  },

  // --------------------------------------------------------------------------
  // RAGFlow Integration Configuration
  // --------------------------------------------------------------------------
  
  /**
   * RAGFlow AI Chat and Search iframe configuration.
   * URLs point directly to RAGFlow instances (no proxy).
   */
  ragflow: {
    /** Primary AI Chat iframe URL */
    aiChatUrl: process.env['RAGFLOW_AI_CHAT_URL'] ?? '',
    /** Primary AI Search iframe URL */
    aiSearchUrl: process.env['RAGFLOW_AI_SEARCH_URL'] ?? '',

    /**
     * Multiple chat sources for source selection.
     * Allows switching between different RAGFlow chat instances.
     */
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
    /**
     * Multiple search sources for source selection.
     * Allows switching between different RAGFlow search instances.
     */
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

  // --------------------------------------------------------------------------
  // Langfuse Observability Configuration
  // --------------------------------------------------------------------------
  
  /**
   * Langfuse configuration for LLM observability and tracing.
   * Used to log chat/search interactions for analytics and debugging.
   */
  langfuse: {
    /** Langfuse secret key for server-side operations */
    secretKey: process.env['LANGFUSE_SECRET_KEY'] ?? '',
    /** Langfuse public key for client identification */
    publicKey: process.env['LANGFUSE_PUBLIC_KEY'] ?? '',
    /** Langfuse API base URL (self-hosted or cloud) */
    baseUrl: process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com',
  },

  // --------------------------------------------------------------------------
  // Azure Entra ID (Azure AD) Configuration
  // --------------------------------------------------------------------------
  
  /**
   * Azure Entra ID OAuth 2.0 configuration.
   * Handles user authentication via Microsoft identity platform.
   */
  azureAd: {
    /** Azure AD Application (client) ID */
    clientId: getEnv('AZURE_AD_CLIENT_ID', ''),
    /** Azure AD Client secret for confidential client auth */
    clientSecret: getEnv('AZURE_AD_CLIENT_SECRET', ''),
    /** Azure AD Tenant (directory) ID */
    tenantId: getEnv('AZURE_AD_TENANT_ID', ''),
    /** OAuth callback URL (must match Azure Portal configuration) */
    redirectUri: process.env['AZURE_AD_REDIRECT_URI'] ?? 'http://localhost:3001/api/auth/callback',
  },

  // --------------------------------------------------------------------------
  // Redis Configuration
  // --------------------------------------------------------------------------
  
  /**
   * Redis connection configuration for session storage.
   * Redis provides persistent sessions across server restarts.
   */
  redis: {
    /** Redis server hostname */
    host: process.env['REDIS_HOST'] ?? 'localhost',
    /** Redis server port */
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    /** Redis authentication password (optional) */
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    /** Redis database number (0-15) */
    db: parseInt(process.env['REDIS_DB'] ?? '0', 10),
    /**
     * Constructs Redis connection URL from individual settings.
     * Format: redis://[:password@]host:port/db
     */
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

  // --------------------------------------------------------------------------
  // Session Configuration
  // --------------------------------------------------------------------------
  
  /**
   * Session management settings.
   * Controls session security and lifetime.
   */
  session: {
    /** Secret for signing session ID cookies (required in production) */
    secret: getEnv('SESSION_SECRET', isProduction ? undefined : 'change-me-in-production'),
    /** Session time-to-live in seconds (default: 7 days) */
    ttlSeconds: parseInt(process.env['SESSION_TTL_DAYS'] ?? '7', 10) * 24 * 60 * 60,
  },

  // --------------------------------------------------------------------------
  // Frontend Configuration
  // --------------------------------------------------------------------------
  
  /** Frontend application URL for CORS and redirects */
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',

  /**
   * Shared storage domain for cross-subdomain user info sharing.
   * Set to parent domain (e.g., '.example.com') for subdomain session sharing.
   */
  sharedStorageDomain: process.env['SHARED_STORAGE_DOMAIN'] ?? '.localhost',
} as const;

/**
 * Type definition for the configuration object.
 * Useful for function parameters that need config type hints.
 */
export type Config = typeof config;

