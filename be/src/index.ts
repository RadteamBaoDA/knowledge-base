import express from 'express';
import https from 'https';
import http from 'http';
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
import authRoutes from './routes/auth.routes.js';
import ragflowRoutes from './routes/ragflow.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import systemToolsRoutes from './routes/system-tools.routes.js';
import { runMigrations } from './db/migrations/runner.js';

const app = express();

// Session store setup based on configuration
let sessionStore: RedisStore | undefined;
let redisClient: ReturnType<typeof createClient> | null = null;

if (config.sessionStore.type === 'redis') {
  redisClient = createClient({
    url: config.redis.url,
  });

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
} else {
  log.info('Session store: MemoryStore (in-memory sessions)');
}

// CORS configuration - must be before other middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
}));

// Compression middleware
app.use(compression());

// Session configuration
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

// Security middleware for other routes
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
      frameAncestors: ["'self'", config.frontendUrl],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  log.debug('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/ragflow', ragflowRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system-tools', systemToolsRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server (HTTP or HTTPS based on config)
const startServer = async (): Promise<http.Server | https.Server> => {
  // Connect to Redis if configured
  if (config.sessionStore.type === 'redis' && redisClient) {
    try {
      await redisClient.connect();
      sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'kb:sess:',
        ttl: config.session.ttlSeconds,
      });
      log.info('Session store: Redis', { url: config.redis.url.replace(/:[^:@]*@/, ':***@') });
    } catch (err) {
      log.warn('Failed to connect to Redis, falling back to MemoryStore', {
        error: err instanceof Error ? err.message : String(err),
      });
      // sessionStore remains undefined, will use MemoryStore
    }
  }

  let server: http.Server | https.Server;
  const protocol = config.https.enabled ? 'https' : 'http';

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

  server.listen(config.port, async () => {
    log.info(`Backend server started`, {
      url: `${protocol}://${config.devDomain}:${config.port}`,
      environment: config.nodeEnv,
      https: config.https.enabled,
      sessionTTL: `${config.session.ttlSeconds / 86400} days`,
    });

    // Check database connection
    const dbConnected = await checkConnection();
    if (dbConnected) {
      log.info('Database connected successfully');

      // Run migrations
      try {
        const db = await getAdapter();
        await runMigrations(db);
      } catch (error) {
        log.error('Failed to run migrations', { error });
        process.exit(1);
      }

      // Initialize root user
      await userService.initializeRootUser();
    } else {
      log.warn('Database connection failed - run npm run db:migrate first');
    }
  });

  return server;
};

// Only start server if this file is run directly or not in test mode
// The import.meta.url check can be flaky on Windows with tsx
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
if (!isTest) {
  startServer().then((server) => {
    // Graceful shutdown
    const shutdown = async () => {
      log.info('Shutting down server...');

      server.close(() => {
        log.info('HTTP server closed');
      });

      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        log.info('Redis client disconnected');
      }

      await closePool();
      await shutdownLangfuse();

      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }).catch((err) => {
    log.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}

export { app, startServer };
