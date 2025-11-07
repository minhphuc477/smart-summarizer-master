import { NextRequest, NextResponse } from 'next/server';
import { dispatchPendingDeliveries } from '@/lib/webhooks';

// Protect this endpoint with a simple header token
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Missing CRON_SECRET' }, { status: 500 });
  }
  const header = req.headers.get('x-internal-token');
  if (header !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);

  const result = await dispatchPendingDeliveries(limit);
  return NextResponse.json({ ok: true, ...result });
}
