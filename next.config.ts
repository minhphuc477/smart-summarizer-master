import createNextPwa from 'next-pwa';
import { withSentryConfig } from '@sentry/nextjs';

const withPWA = createNextPwa({
  dest: 'public',
  // By default, disable PWA in dev to avoid SW caching issues.
  // Set PWA_DEV=true to enable PWA while running `next dev`.
  disable: process.env.NODE_ENV === 'development' && process.env.PWA_DEV !== 'true',
  register: true,
  skipWaiting: true,
  // Increase max file size for precaching to handle large source maps
  runtimeCaching: [],
  buildExcludes: [/\.map$/], // Exclude source maps from precaching
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
});

const nextConfig = {
  eslint: {
    // Temporarily ignore ESLint errors during builds to allow development
    ignoreDuringBuilds: true,
  },
  // Externalize packages with native dependencies from server bundling
  serverExternalPackages: ['@napi-rs/canvas', 'canvas', 'pdf-parse'],
};

// Wrap with Sentry config
const sentryConfig = withSentryConfig(
  withPWA(nextConfig),
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: '/monitoring',

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    automaticVercelMonitors: true,
  }
);

export default sentryConfig;

