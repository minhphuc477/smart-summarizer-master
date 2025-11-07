/**
 * Unit tests for advanced logging system
 */

import { logger, createRequestLogger, logDatabaseQuery, logExternalAPICall, LogContext } from '../logger';

describe('Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      
      const logCall = consoleDebugSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('DEBUG');
      expect(logEntry.message).toBe('Test debug message');
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should log info messages', () => {
      logger.info('Test info message');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('Test info message');
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      
      const logCall = consoleWarnSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('WARN');
      expect(logEntry.message).toBe('Test warning message');
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Test error message', error);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      const logCall = consoleErrorSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.message).toBe('Test error message');
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
    });
  });

  describe('Context Logging', () => {
    it('should include context in log entries', () => {
      const context: LogContext = {
        userId: 'user-123',
        requestId: 'req-456',
      };

      logger.info('Test with context', context);
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.context).toEqual(context);
    });

    it('should include metadata in log entries', () => {
      const metadata = {
        duration: 150,
        status: 'success',
      };

      logger.info('Test with metadata', undefined, metadata);
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.metadata).toEqual(metadata);
    });

    it('should include both context and metadata', () => {
      const context: LogContext = { userId: 'user-123' };
      const metadata = { duration: 150 };

      logger.info('Test with both', context, metadata);
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.context).toEqual(context);
      expect(logEntry.metadata).toEqual(metadata);
    });
  });

  describe('Request/Response Logging', () => {
    it('should log API requests', () => {
      logger.logRequest('GET', '/api/summarize', { userId: 'user-123' });
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.message).toBe('GET /api/summarize');
      expect(logEntry.context.method).toBe('GET');
      expect(logEntry.context.endpoint).toBe('/api/summarize');
      expect(logEntry.context.type).toBe('request');
      expect(logEntry.context.userId).toBe('user-123');
    });

    it('should log successful responses with INFO level', () => {
      logger.logResponse('GET', '/api/summarize', 200, 150);
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('GET /api/summarize - 200');
      expect(logEntry.context.statusCode).toBe(200);
      expect(logEntry.duration).toBe(150);
    });

    it('should log client errors with WARN level', () => {
      logger.logResponse('POST', '/api/summarize', 400, 50);
      
      // Get the last call (since previous tests may have logged)
      const logCall = consoleWarnSpy.mock.calls[consoleWarnSpy.mock.calls.length - 1][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('WARN');
      expect(logEntry.message).toBe('POST /api/summarize - 400');
      expect(logEntry.context.statusCode).toBe(400);
    });

    it('should log server errors with ERROR level', () => {
      logger.logResponse('POST', '/api/summarize', 500, 100);
      
      // Get the last call (since previous tests may have logged)
      const logCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.message).toBe('POST /api/summarize - 500');
      expect(logEntry.context.statusCode).toBe(500);
    });
  });

  describe('Performance Tracking', () => {
    it('should track successful operation performance', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      };

      const result = await logger.trackPerformance('test-operation', operation);

      expect(result).toBe('success');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1); // Starting log
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1); // Completed log
      
      const completedLog = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(completedLog);
      
      expect(logEntry.message).toBe('Completed: test-operation');
      expect(logEntry.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track failed operation performance', async () => {
      // Clear spies before this test
      consoleDebugSpy.mockClear();
      consoleErrorSpy.mockClear();
      
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Operation failed');
      };

      await expect(
        logger.trackPerformance('failed-operation', operation)
      ).rejects.toThrow('Operation failed');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1); // Starting log
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // Failed log
      
      const failedLog = consoleErrorSpy.mock.calls[0][0];
      const logEntry = JSON.parse(failedLog);
      
      expect(logEntry.message).toBe('Failed: failed-operation');
      expect(logEntry.error.message).toBe('Operation failed');
    });

    it('should include context in performance tracking', async () => {
      const operation = async () => 'success';
      const context: LogContext = { userId: 'user-123' };

      await logger.trackPerformance('test-operation', operation, context);

      const completedLog = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(completedLog);
      
      expect(logEntry.context.userId).toBe('user-123');
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional context', () => {
      const childLogger = logger.child({ userId: 'user-123' });
      
      childLogger.info('Child logger message');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.context.userId).toBe('user-123');
    });

    it('should merge parent and child contexts', () => {
      const childLogger = logger.child({ userId: 'user-123' });
      
      childLogger.info('Message', { requestId: 'req-456' });
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.context.userId).toBe('user-123');
      expect(logEntry.context.requestId).toBe('req-456');
    });
  });

  describe('Helper Functions', () => {
    it('should create request logger with proper context', () => {
      // Mock Request for Node environment
      global.Request = class Request {
        url: string;
        method: string;
        headers: Map<string, string>;

        constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
          this.url = url;
          this.method = init?.method || 'GET';
          this.headers = new Map(Object.entries(init?.headers || {}));
        }

        get(key: string) {
          return this.headers.get(key) || null;
        }
      } as any;

      const mockRequest = new Request('http://localhost:3000/api/summarize', {
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      }) as any;

      mockRequest.headers.get = (key: string) => key === 'user-agent' ? 'Mozilla/5.0' : null;

      const requestLogger = createRequestLogger(mockRequest);
      
      requestLogger.info('Test message');
      
      const logCall = consoleInfoSpy.mock.calls[consoleInfoSpy.mock.calls.length - 1][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.context.endpoint).toBe('/api/summarize');
      expect(logEntry.context.method).toBe('POST');
      expect(logEntry.context.userAgent).toBe('Mozilla/5.0');
      expect(logEntry.context.requestId).toBeDefined();
    });

    it('should log database queries', () => {
      logDatabaseQuery('SELECT * FROM notes WHERE id = $1', ['note-123'], 50);
      
      const logCall = consoleDebugSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.message).toBe('Database query');
      expect(logEntry.metadata.query).toBe('SELECT * FROM notes WHERE id = $1');
      expect(logEntry.metadata.params).toEqual(['note-123']);
      expect(logEntry.metadata.duration).toBe(50);
      expect(logEntry.metadata.type).toBe('database');
    });

    it('should log successful external API calls', () => {
      logExternalAPICall('Groq', '/v1/chat/completions', 500, true);
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.message).toBe('External API call to Groq');
      expect(logEntry.metadata.service).toBe('Groq');
      expect(logEntry.metadata.duration).toBe(500);
      expect(logEntry.metadata.success).toBe(true);
    });

    it('should log failed external API calls', () => {
      logExternalAPICall('Groq', '/v1/chat/completions', 500, false, 'Timeout');
      
      // Get the last error call
      const logCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.message).toBe('External API call to Groq failed');
      expect(logEntry.metadata.success).toBe(false);
      expect(logEntry.metadata.error).toBe('Timeout');
    });
  });
});
