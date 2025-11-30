/**
 * @fileoverview Main application entry point for the Knowledge Base backend server.
 * 
 * This file initializes and configures the Express.js server with:
 * - CORS configuration for frontend communication
 * - Session management (Redis or in-memory)
 * - Security middleware (Helmet, compression)
 * - API routes for authentication, RAGFlow, admin, users, and MinIO storage
 * - Database connection and migration handling
 * - Graceful shutdown handling
 * 
 * @module index
 * @requires express
 * @requires express-session
 * @requires connect-redis
 */

import express from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { config } from './config/index.js';
import { log } from './services/logger.service.js';
import { shutdownLangfuse } from './services/langfuse.service.js';
import { checkConnection, closePool, getAdapter } from './db/index.js';
import { userService } from './services/user.service.js';
import { systemToolsService } from './services/system-tools.service.js';
import { minioService } from './services/minio.service.js';
import authRoutes from './routes/auth.routes.js';
import ragflowRoutes from './routes/ragflow.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import systemToolsRoutes from './routes/system-tools.routes.js';
import minioBucketRoutes from './routes/minio-bucket.routes.js';
import minioStorageRoutes from './routes/minio-storage.routes.js';
import { runMigrations } from './db/migrations/runner.js';

/**
 * ESM-compatible __filename and __dirname resolution.
 * Required because ES modules don't have these globals like CommonJS.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Express application instance */
const app = express();

// ============================================================================
// SESSION STORE CONFIGURATION
// ============================================================================

/**
 * Session store instance - either RedisStore for production or undefined for MemoryStore.
 * RedisStore provides persistent session storage across server restarts and load-balanced instances.
 * MemoryStore is used for development but sessions are lost on restart.
 */
let sessionStore: RedisStore | undefined;

/**
 * Redis client instance for session storage.
 * Only initialized when SESSION_STORE=redis in configuration.
 */
let redisClient: ReturnType<typeof createClient> | null = null;

// Initialize Redis client if configured for Redis session storage
if (config.sessionStore.type === 'redis') {
  redisClient = createClient({
    url: config.redis.url,
  });

  // Redis event handlers for connection lifecycle logging
  redisClient.on('error', (err) => {
    log.error('Redis client error', { error: err.message });
  });

  redisClient.on('connect', () => {
    log.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    log.info('Redis client ready');
  });

  redisClient.on('reconnecting', () => {
    log.warn('Redis client reconnecting');
  });

  // Initialize store immediately with the client
  sessionStore = new RedisStore({
    client: redisClient,
    prefix: 'kb:sess:',
    ttl: config.session.ttlSeconds,
  });
} else {
  log.info('Session store: MemoryStore (in-memory sessions)');
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

/**
 * CORS (Cross-Origin Resource Sharing) configuration.
 * Must be applied before other middleware to properly handle preflight requests.
 * 
 * - origin: Allows requests from the configured frontend URL only
 * - credentials: Enables cookies/session sharing across origins
 * - methods: Allowed HTTP methods for cross-origin requests
 * - allowedHeaders: Headers that can be sent in cross-origin requests
 */
const rootDomain = config.sharedStorageDomain.startsWith('.')
  ? config.sharedStorageDomain.substring(1)
  : config.sharedStorageDomain;

app.use(cors({
  origin: (requestOrigin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!requestOrigin) return callback(null, true);

    // Check if exact match with frontendUrl
    if (requestOrigin === config.frontendUrl) return callback(null, true);

    // Check if same root domain
    try {
      const originUrl = new URL(requestOrigin);
      if (originUrl.hostname === rootDomain || originUrl.hostname.endsWith('.' + rootDomain)) {
        return callback(null, true);
      }
    } catch (e) {
      // Invalid URL, ignore
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
}));

/**
 * Response compression middleware.
 * Compresses HTTP responses using gzip/deflate to reduce bandwidth usage.
 */
app.use(compression());

/**
 * Static file serving for public assets.
 * Files in the 'public' directory are served at the '/static' URL path.
 * Used for icons, images, and other static resources.
 */
app.use('/static', express.static(path.join(__dirname, '../public')));

/**
 * Session middleware configuration.
 * Manages user sessions with secure cookie settings.
 * 
 * Configuration details:
 * - store: Redis store for production, MemoryStore for development
 * - secret: Used to sign session ID cookie (must be secure in production)
 * - resave: Don't save session if not modified
 * - saveUninitialized: Don't create session until something is stored
 * - cookie.secure: Only send cookie over HTTPS in production
 * - cookie.httpOnly: Prevent JavaScript access to cookie (XSS protection)
 * - cookie.maxAge: Session expiration time (default: 7 days)
 * - cookie.domain: Enables cross-subdomain session sharing
 * - cookie.sameSite: CSRF protection - 'lax' allows top-level navigation
 */
app.use(session({
  store: sessionStore, // undefined = MemoryStore
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.https.enabled || config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: config.session.ttlSeconds * 1000, // Convert to milliseconds
    // Set domain for cross-subdomain session sharing
    domain: config.sharedStorageDomain !== '.localhost' ? config.sharedStorageDomain : undefined,
    sameSite: 'lax',
  },
}));

/**
 * Helmet security middleware.
 * Sets various HTTP headers to help protect against common web vulnerabilities.
 * 
 * Content Security Policy (CSP) directives:
 * - Configured to allow RAGFlow iframe embedding
 * - Allows inline scripts/styles for compatibility with various components
 * - Permits cross-origin resources for external APIs and assets
 * 
 * Cross-Origin settings:
 * - crossOriginEmbedderPolicy: Disabled to allow embedding external resources
 * - crossOriginResourcePolicy: Set to 'cross-origin' for shared resources
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      fontSrc: ["'self'", "data:", "*"],
      connectSrc: ["'self'", "*"],
      frameSrc: ["'self'", "*"],
      frameAncestors: ["'self'", config.frontendUrl, `http://*.${rootDomain}`, `https://*.${rootDomain}`, "http://*", "https://*"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/**
 * Request body parsing middleware.
 * - express.json(): Parses JSON request bodies
 * - express.urlencoded(): Parses URL-encoded form data (with nested object support)
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * Health check endpoint for load balancers and monitoring systems.
 * Returns a simple JSON response with server status and timestamp.
 * Used by Docker, Kubernetes, and other orchestration tools.
 */
app.get('/health', (_req, res) => {
  log.debug('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * API Route Registration.
 * All routes are prefixed with '/api/' for clear API namespace separation.
 * 
 * Route handlers:
 * - /api/auth: Authentication (Azure AD OAuth, session management, logout)
 * - /api/ragflow: RAGFlow iframe configuration for AI Chat/Search
 * - /api/admin: Administrative operations (requires admin API key)
 * - /api/users: User management (RBAC, role updates)
 * - /api/system-tools: System monitoring tools configuration
 * - /api/minio/buckets: MinIO bucket CRUD operations
 * - /api/minio/storage: File upload/download/delete operations
 */
app.use('/api/auth', authRoutes);
app.use('/api/ragflow', ragflowRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system-tools', systemToolsRoutes);
app.use('/api/minio/buckets', minioBucketRoutes);
app.use('/api/minio/storage', minioStorageRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Global error handling middleware.
 * Catches unhandled errors from route handlers and middleware.
 * 
 * - Logs error details for debugging (message and stack trace)
 * - Returns a generic 500 error to clients (hides implementation details)
 * - Must be defined after all other middleware and routes
 */
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Initializes and starts the HTTP/HTTPS server.
 * 
 * Startup sequence:
 * 1. Connect to Redis for session storage (if configured)
 * 2. Create HTTP or HTTPS server based on configuration
 * 3. Start listening on configured port
 * 4. Verify database connection
 * 5. Run pending database migrations
 * 6. Initialize root user if database is empty
 * 
 * @returns Promise resolving to the HTTP/HTTPS server instance
 */
const startServer = async (): Promise<http.Server | https.Server> => {
  // Connect to Redis for session storage (production recommended)
  if (config.sessionStore.type === 'redis' && redisClient) {
    try {
      await redisClient.connect();
      // Configure Redis session store with key prefix and TTL
      sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'kb:sess:',  // Key prefix for session identification
        ttl: config.session.ttlSeconds,  // Session time-to-live
      });
      log.info('Session store: Redis', { url: config.redis.url.replace(/:[^:@]*@/, ':***@') });
    } catch (err) {
      log.warn('Failed to connect to Redis', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Note: If Redis fails, session middleware might fail or hang depending on connect-redis behavior
    }
  }

  let server: http.Server | https.Server;
  const protocol = config.https.enabled ? 'https' : 'http';

  // Create HTTPS or HTTP server based on configuration
  // HTTPS requires SSL certificates (key.pem, cert.pem) in the certs directory
  if (config.https.enabled) {
    const credentials = config.https.getCredentials();
    if (credentials) {
      server = https.createServer(credentials, app);
      log.info('HTTPS enabled with SSL certificates');
    } else {
      log.warn('HTTPS enabled but certificates not found, falling back to HTTP');
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  // Start listening and perform post-startup initialization
  server.listen(config.port, async () => {
    log.info(`Backend server started`, {
      url: `${protocol}://${config.devDomain}:${config.port}`,
      environment: config.nodeEnv,
      https: config.https.enabled,
      sessionTTL: `${config.session.ttlSeconds / 86400} days`,
    });

    // Verify database connectivity
    const dbConnected = await checkConnection();
    if (dbConnected) {
      log.info('Database connected successfully');

      // Execute pending database migrations
      try {
        const db = await getAdapter();
        await runMigrations(db);
      } catch (error) {
        log.error('Failed to run migrations', { error });
        process.exit(1);
      }

      // Create default admin user if no users exist
      await userService.initializeRootUser();
    } else {
      log.warn('Database connection failed - run npm run db:migrate first');
    }
  });

  return server;
};

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

/**
 * Conditional server startup.
 * Only starts the server when:
 * - Running as the main entry point (not imported as a module)
 * - Not in test mode (NODE_ENV !== 'test' and no VITEST env)
 * 
 * This allows the app to be imported for testing without starting the server.
 */
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
if (!isTest) {
  startServer().then((server) => {
    /**
     * Graceful shutdown handler.
     * Properly closes all connections and resources before exiting:
     * 1. Stop accepting new HTTP connections
     * 2. Close Redis client connection
     * 3. Close database connection pool
     * 4. Flush Langfuse traces and shutdown client
     * 5. Exit process with success code
     * 
     * Triggered by SIGTERM (Docker/K8s stop) or SIGINT (Ctrl+C)
     */
    const shutdown = async () => {
      log.info('Shutting down server...');

      // Stop accepting new connections
      server.close(() => {
        log.info('HTTP server closed');
      });

      // Disconnect Redis session store
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        log.info('Redis client disconnected');
      }

      // Close database connections
      await closePool();

      // Flush and close Langfuse client
      await shutdownLangfuse();

      process.exit(0);
    };

    // Register signal handlers for graceful shutdown
    process.on('SIGTERM', shutdown);  // Docker/Kubernetes stop signal
    process.on('SIGINT', shutdown);   // Ctrl+C interrupt signal
  }).catch((err) => {
    log.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}

export { app, startServer };
