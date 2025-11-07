/**
 * Advanced Logging System for Smart Summarizer
 * 
 * Features:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - Structured logging with metadata
 * - Performance tracking
 * - Error tracking with stack traces
 * - Request/Response logging
 * - Development vs Production modes
 * - Sentry integration for error tracking
 */

import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.isDevelopment ? 'DEBUG' : 'INFO');
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Pretty print for development
      return JSON.stringify(entry, null, 2);
    }
    // Single line JSON for production (easier for log aggregation tools)
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
    };

    const formatted = this.formatMessage(entry);

    switch (level) {
      case 'DEBUG':
        console.debug(formatted);
        break;
      case 'INFO':
        console.info(formatted);
        break;
      case 'WARN':
        console.warn(formatted);
        break;
      case 'ERROR':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log('DEBUG', message, context, metadata);
  }

  info(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log('INFO', message, context, metadata);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log('WARN', message, context, metadata);
  }

  error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      context,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };

      // Capture error in Sentry
      Sentry.captureException(error, {
        tags: {
          logger: 'true',
          ...context,
        },
        contexts: {
          metadata: metadata || {},
        },
        level: 'error',
      });
    } else {
      // Capture message in Sentry if no error object
      Sentry.captureMessage(message, {
        tags: {
          logger: 'true',
          ...context,
        },
        contexts: {
          metadata: metadata || {},
        },
        level: 'error',
      });
    }

    const formatted = this.formatMessage(entry);
    console.error(formatted);
  }

  /**
   * Log API request
   */
  logRequest(method: string, endpoint: string, context?: LogContext) {
    this.info(`${method} ${endpoint}`, {
      ...context,
      method,
      endpoint,
      type: 'request',
    });
  }

  /**
   * Log API response
   */
  logResponse(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO',
      message: `${method} ${endpoint} - ${statusCode}`,
      context: {
        ...context,
        method,
        endpoint,
        statusCode,
        type: 'response',
      },
      duration,
    };

    // Add breadcrumb to Sentry for all API responses
    Sentry.addBreadcrumb({
      category: 'api',
      message: `${method} ${endpoint}`,
      level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info',
      data: {
        statusCode,
        duration,
        ...context,
      },
    });

    // Capture error responses in Sentry
    if (statusCode >= 500) {
      Sentry.captureMessage(`API Error: ${method} ${endpoint}`, {
        level: 'error',
        tags: {
          api: 'true',
          method,
          endpoint,
          statusCode: statusCode.toString(),
        },
        contexts: {
          response: {
            statusCode,
            duration,
            ...context,
          },
        },
      });
    }

    const formatted = this.formatMessage(entry);

    if (entry.level === 'ERROR') {
      console.error(formatted);
    } else if (entry.level === 'WARN') {
      console.warn(formatted);
    } else {
      console.info(formatted);
    }
  }

  /**
   * Performance tracking wrapper
   */
  async trackPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    
    this.debug(`Starting: ${operation}`, context);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.info(`Completed: ${operation}`, context, { duration });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.error(
        `Failed: ${operation}`,
        error as Error,
        context,
        { duration }
      );
      
      throw error;
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger();
    
    // Override log methods to include additional context
    const originalDebug = childLogger.debug.bind(childLogger);
    const originalInfo = childLogger.info.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalError = childLogger.error.bind(childLogger);

    childLogger.debug = (message, context, metadata) => {
      originalDebug(message, { ...additionalContext, ...context }, metadata);
    };

    childLogger.info = (message, context, metadata) => {
      originalInfo(message, { ...additionalContext, ...context }, metadata);
    };

    childLogger.warn = (message, context, metadata) => {
      originalWarn(message, { ...additionalContext, ...context }, metadata);
    };

    childLogger.error = (message, error, context, metadata) => {
      originalError(message, error, { ...additionalContext, ...context }, metadata);
    };

    return childLogger;
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Middleware helper to create request-scoped logger
 */
export function createRequestLogger(req: Request): Logger {
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);
  
  return logger.child({
    requestId,
    endpoint: url.pathname,
    method: req.method,
    userAgent: req.headers.get('user-agent') || undefined,
  });
}

/**
 * Set user context in Sentry for better error tracking
 */
export function setUserContext(userId: string, email?: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context in Sentry (e.g., on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Helper to log database queries
 */
export function logDatabaseQuery(
  query: string,
  params?: unknown[],
  duration?: number
) {
  logger.debug('Database query', undefined, {
    query,
    params,
    duration,
    type: 'database',
  });
}

/**
 * Helper to log external API calls
 */
export function logExternalAPICall(
  service: string,
  endpoint: string,
  duration: number,
  success: boolean,
  error?: string
) {
  if (success) {
    logger.info(`External API call to ${service}`, undefined, {
      service,
      endpoint,
      duration,
      success,
      type: 'external_api',
    });
  } else {
    logger.error(`External API call to ${service} failed`, undefined, undefined, {
      service,
      endpoint,
      duration,
      success,
      error,
      type: 'external_api',
    });
  }
}

export default logger;
