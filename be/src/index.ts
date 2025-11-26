import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { config } from './config/index.js';
import { shutdownLangfuse } from './services/langfuse.service.js';
import chatRoutes from './routes/chat.routes.js';
import searchRoutes from './routes/search.routes.js';
import authRoutes from './routes/auth.routes.js';

const app = express();

// Security middleware
app.use(helmet({
  // Allow iframe embedding for RAGFlow proxy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameSrc: ["*"],
      frameAncestors: ["'self'", config.frontendUrl],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);

// RAGFlow iframe config endpoint - returns URLs for frontend
app.get('/api/ragflow/config', (_req, res) => {
  res.json({
    aiChat: config.ragflow.aiChat,
    aiSearch: config.ragflow.aiSearch,
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(config.port, () => {
  console.log(`🚀 Backend server running on http://localhost:${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdownLangfuse();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdownLangfuse();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
