import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';
import { config } from '../config/index.js';

// Log directory - relative to current working directory (be/)
const logDir = join(process.cwd(), 'logs');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level} ${message}${metaStr}`;
  })
);

// Determine log level from environment
const getLogLevel = (): string => {
  const envLevel = process.env['LOG_LEVEL']?.toLowerCase();
  if (envLevel && ['error', 'warn', 'info', 'debug'].includes(envLevel)) {
    return envLevel;
  }
  return config.nodeEnv === 'production' ? 'info' : 'debug';
};

// Daily rotate transport for all logs
const allLogsTransport: DailyRotateFile = new DailyRotateFile({
  dirname: logDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // Keep 14 days of logs
  level: getLogLevel(),
  format: logFormat,
});

// Daily rotate transport for error logs only
const errorLogsTransport: DailyRotateFile = new DailyRotateFile({
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Keep 30 days of error logs
  level: 'error',
  format: logFormat,
});

// Create the logger
const logger = winston.createLogger({
  level: getLogLevel(),
  format: logFormat,
  defaultMeta: { service: 'knowledge-base-backend' },
  transports: [
    allLogsTransport,
    errorLogsTransport,
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add console transport in development
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: getLogLevel(),
  }));
} else {
  // In production, still log to console but with less verbosity
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'info',
  }));
}

// Handle transport errors
allLogsTransport.on('error', (error) => {
  console.error('Error writing to log file:', error);
});

errorLogsTransport.on('error', (error) => {
  console.error('Error writing to error log file:', error);
});

// Log rotation events
allLogsTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { oldFilename, newFilename });
});

// Export convenience methods
export const log = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta);
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta);
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta);
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    logger.error(message, meta);
  },
};

export { logger };
export default logger;
