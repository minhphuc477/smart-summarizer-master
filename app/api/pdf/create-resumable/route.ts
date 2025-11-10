import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * POST /api/pdf/create-resumable
 * Body: { filename: string, size: number, bucket?: string }
 * Creates a TUS resumable upload on Supabase Storage on behalf of the authenticated user
 * and returns the Location header (the upload URL) to the client.
 */
export async function POST(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  try {
    const body = await req.json();
    const { filename, size, bucket = 'pdf-documents' } = body;
    if (!filename || !size) return NextResponse.json({ error: 'filename and size are required' }, { status: 400 });

    const supabase = await getServerSupabase();

    // Build path under user's id
    // We need the user id from session; use server client to get user via auth api
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.warn('User not authenticated for create-resumable', undefined, { supabaseError: authError });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = user.id;

    const tusEndpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;
    const path = `${bucket}/${userId}/${Date.now()}-${filename}`;

    // Create the resumable upload using the server-side client (which will forward cookies)
    const createResp = await fetch(tusEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Upload-Length': String(size),
        'Tus-Resumable': '1.0.0',
        'Upload-Metadata': `bucketName ${btoa(bucket)},objectName ${btoa(path)},contentType ${btoa('application/pdf')},cacheControl ${btoa('3600')}`,
        'x-upsert': 'false'
      }
    });

    if (!createResp.ok) {
      const text = await createResp.text().catch(() => 'Unknown');
      logger.error('Failed to create resumable upload (server)', undefined, { status: createResp.status, body: text });
      return NextResponse.json({ error: 'Failed to create resumable upload' }, { status: 500 });
    }

    const location = createResp.headers.get('Location');
    if (!location) return NextResponse.json({ error: 'Missing upload Location' }, { status: 500 });

    logger.logResponse('POST', '/api/pdf/create-resumable', 200, Date.now() - start);
    return NextResponse.json({ success: true, uploadUrl: location });
  } catch (error: unknown) {
    logger.error('Error in /api/pdf/create-resumable', error as Error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
