// This file configures the initialization of Sentry on the client (browser).
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replay settings for session replay
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5, // 10% in prod, 50% in dev

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out sensitive errors or expected errors
  beforeSend(event, hint) {
    // Don't send errors from browser extensions
    const error = hint.originalException;
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      (error.message.includes('chrome-extension://') ||
        error.message.includes('moz-extension://'))
    ) {
      return null;
    }

    // Filter out network errors that are expected
    if (
      event.exception?.values?.[0]?.type === 'NetworkError' ||
      event.message?.includes('Failed to fetch')
    ) {
      // Only send if it's not a temporary network issue
      if (event.tags?.['api.endpoint']) {
        return event; // Send API errors
      }
      return null; // Drop client network errors
    }

    return event;
  },

  // Set environment
  environment: process.env.NODE_ENV,

  // Add release version for better tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',

  // Ignore certain errors
  ignoreErrors: [
    // Browser extension errors
    'top.GLOBALS',
    'chrome-extension://',
    'moz-extension://',
    // Network errors that are expected
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    // User cancelled actions
    'AbortError',
    'Request aborted',
    // Expected auth errors
    'Unauthorized',
    'Session expired',
    // Common browser errors
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],

  // Set tags for better filtering
  initialScope: {
    tags: {
      'app.name': 'smart-summarizer',
      'app.version': '1.0.0',
    },
  },
});
