import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * POST /api/pdf/create-resumable-service
 * Server-side creation of TUS resumable uploads using the SUPABASE_SERVICE_ROLE_KEY.
 * Body: { filename: string, size: number, bucket?: string }
 * This endpoint authenticates the user via cookies, then uses the service key to create
 * the storage resumable resource under the user's folder. Use this when storage policies
 * require server-side creation with elevated privileges.
 */
export async function POST(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  try {
    const body = await req.json();
    const { filename, size, bucket = 'pdf-documents' } = body;
    if (!filename || !size) return NextResponse.json({ error: 'filename and size are required' }, { status: 400 });

    const supabase = await getServerSupabase();
    // Ensure user is authenticated to determine destination path
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.warn('User not authenticated for create-resumable-service', undefined, { supabaseError: authError });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = user.id;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      logger.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const tusEndpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;
    const path = `${bucket}/${userId}/${Date.now()}-${filename}`;

    const createResp = await fetch(tusEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Upload-Length': String(size),
        'Tus-Resumable': '1.0.0',
        'Upload-Metadata': `bucketName ${btoa(bucket)},objectName ${btoa(path)},contentType ${btoa('application/pdf')},cacheControl ${btoa('3600')}`,
        'x-upsert': 'false'
      }
    });

    if (!createResp.ok) {
      const text = await createResp.text().catch(() => 'Unknown');
      logger.error('Failed to create resumable upload (service)', undefined, { status: createResp.status, body: text });
      return NextResponse.json({ error: 'Failed to create resumable upload' }, { status: 500 });
    }

    const location = createResp.headers.get('Location');
    if (!location) return NextResponse.json({ error: 'Missing upload Location' }, { status: 500 });

    logger.logResponse('POST', '/api/pdf/create-resumable-service', 200, Date.now() - start);
    return NextResponse.json({ success: true, uploadUrl: location });
  } catch (error: unknown) {
    logger.error('Error in /api/pdf/create-resumable-service', error as Error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
