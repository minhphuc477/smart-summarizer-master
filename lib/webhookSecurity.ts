import crypto from 'crypto';

export function computeSignature(secret: string, payload: object, timestamp: number): string {
  const raw = `${timestamp}.${JSON.stringify(payload)}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(raw, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

export function verifySignature(signature: string, secret: string, payload: object, timestamp: number, toleranceSec = 300): boolean {
  if (!signature || !signature.startsWith('sha256=')) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) return false;
  const expected = computeSignature(secret, payload, timestamp);
  // Constant-time compare
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
