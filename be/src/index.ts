import express from 'express';
import https from 'https';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { config } from './config/index.js';
import { log } from './services/logger.service.js';
import { shutdownLangfuse } from './services/langfuse.service.js';
import { checkConnection, closePool } from './db/index.js';
import authRoutes from './routes/auth.routes.js';
import ragflowRoutes from './routes/ragflow.routes.js';

const app = express();

// Redis client for session storage
const redisClient = createClient({
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

// CORS configuration - must be before other middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Initialize Redis store (connect-redis v9 uses named export)
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'kb:sess:',
  ttl: config.session.ttlSeconds, // 7 days default
});

// Session configuration with Redis store
app.use(session({
  store: redisStore,
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

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server (HTTP or HTTPS based on config)
const startServer = async (): Promise<http.Server | https.Server> => {
  // Connect to Redis
  try {
    await redisClient.connect();
    log.info('Redis connected', { url: config.redis.url.replace(/:[^:@]*@/, ':***@') });
  } catch (err) {
    log.error('Failed to connect to Redis', { error: err instanceof Error ? err.message : String(err) });
    log.warn('Sessions will use memory store (not recommended for production)');
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
    } else {
      log.warn('Database connection failed - run npm run db:migrate first');
    }
  });

  return server;
};

const serverPromise = startServer();

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  log.info(`${signal} received, shutting down gracefully...`);
  await shutdownLangfuse();
  await closePool();
  
  // Close Redis connection
  if (redisClient.isOpen) {
    await redisClient.quit();
    log.info('Redis connection closed');
  }
  
  const server = await serverPromise;
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
