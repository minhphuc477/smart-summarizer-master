import { NextRequest, NextResponse } from 'next/server';
import { dispatchPendingDeliveries } from '@/lib/webhooks';

/**
 * POST /api/cron/process-webhooks
 * 
 * Background job to process pending webhook deliveries.
 * This should be called by a cron service (e.g., Vercel Cron, GitHub Actions)
 * every minute or as frequently as needed.
 * 
 * Authentication: Uses a secret token to prevent unauthorized access
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'your-secret-token-here';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await dispatchPendingDeliveries(10);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('[Cron] Error processing webhooks:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET /api/cron/process-webhooks
 * Health check endpoint
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'webhook-processor',
    timestamp: new Date().toISOString()
  });
}
