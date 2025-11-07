// instrumentation.ts is used to initialize monitoring and instrumentation in Next.js
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization
    const Sentry = await import('@sentry/nextjs');
    
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Adjust this value in production, or use tracesSampler for greater control
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: false,

      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove sensitive data from request headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }

        // Remove sensitive data from request body
        if (event.request?.data) {
          // If it's a string, try to parse it
          if (typeof event.request.data === 'string') {
            try {
              const parsed = JSON.parse(event.request.data);
              if (parsed.password) delete parsed.password;
              if (parsed.token) delete parsed.token;
              if (parsed.api_key) delete parsed.api_key;
              event.request.data = JSON.stringify(parsed);
            } catch {
              // Not JSON, leave as is but truncate if too long
              if ((event.request.data as string).length > 1000) {
                event.request.data = (event.request.data as string).substring(0, 1000) + '... (truncated)';
              }
            }
          }
        }

        // Filter out expected database errors
        const error = hint.originalException;
        if (
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string'
        ) {
          // Don't send Supabase auth token expiration errors
          if (
            error.message.includes('JWT expired') ||
            error.message.includes('token has expired')
          ) {
            return null;
          }

          // Don't send expected validation errors
          if (
            error.message.includes('Invalid input') ||
            error.message.includes('Validation failed')
          ) {
            return null;
          }
        }

        return event;
      },

      // Set environment
      environment: process.env.NODE_ENV,

      // Add release version
      release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',

      // Ignore certain errors
      ignoreErrors: [
        'JWT expired',
        'token has expired',
        'Invalid input',
        'Validation failed',
        'Unauthorized',
        'Session expired',
      ],

      // Set tags
      initialScope: {
        tags: {
          'app.name': 'smart-summarizer',
          'app.version': '1.0.0',
          runtime: 'nodejs',
        },
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry initialization
    const Sentry = await import('@sentry/nextjs');
    
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: false,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',
      initialScope: {
        tags: {
          'app.name': 'smart-summarizer',
          'app.version': '1.0.0',
          runtime: 'edge',
        },
      },
    });
  }
}

export const onRequestError = async (
  err: Error,
  request: {
    path: string; // resource path, e.g. /blog?name=foo
    method: string; // request method. e.g. GET, POST, etc
    headers: { [key: string]: string }; // request headers
  },
  context: {
    routerKind: 'Pages Router' | 'App Router'; // the router type
    routePath: string; // the route file path, e.g. /app/blog/[dynamic]
    routeType: 'render' | 'route' | 'action' | 'middleware'; // the context in which the error occurred
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering';
    revalidateReason: 'on-demand' | 'stale' | undefined; // undefined is a normal request outside of revalidation
    renderType: 'dynamic' | 'dynamic-resume'; // whether the page was prerendered or not
  }
) => {
  // Import Sentry dynamically to avoid loading it in the client bundle
  const Sentry = await import('@sentry/nextjs');

  // Capture the error with context
  Sentry.captureException(err, {
    tags: {
      'router.kind': context.routerKind,
      'router.type': context.routeType,
      'render.source': context.renderSource,
    },
    contexts: {
      request: {
        url: request.path,
        method: request.method,
      },
      route: {
        path: context.routePath,
        type: context.routeType,
      },
    },
  });
};
