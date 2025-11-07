import { NextRequest, NextResponse } from 'next/server'

// Simple local receiver to help test webhook delivery end-to-end during development
// POST /api/dev/webhook-receiver
export async function POST(req: NextRequest) {
  const bodyText = await req.text()
  const headers = Object.fromEntries(req.headers.entries())

  // Log minimal info to server console
  console.log('[Webhook Receiver] Event:', headers['x-ss-event'], 'Delivery:', headers['x-ss-delivery-id'])

  return NextResponse.json({
    received: true,
    method: req.method,
    headers,
    body: bodyText ? safeParse(bodyText) : null,
    timestamp: new Date().toISOString(),
  })
}

function safeParse(txt: string) {
  try { return JSON.parse(txt) } catch { return txt }
}
