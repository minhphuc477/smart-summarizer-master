import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * GET /api/notes/[id]/versions - Get version history for a note
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const noteId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify note ownership
    const { data: note } = await supabase
      .from('notes')
      .select('id, user_id')
      .eq('id', noteId)
      .single();

    if (!note) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.user_id !== user.id) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all versions with user info
    const { data: versions, error } = await supabase
      .from('note_versions')
      .select(`
        *,
        user:user_id (
          email,
          raw_user_meta_data
        )
      `)
      .eq('note_id', noteId)
      .order('version_number', { ascending: false });

    if (error) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions`, 500, Date.now() - startTime);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format versions with user info
    const formattedVersions = versions?.map((version) => ({
      ...version,
      user_name: version.user?.raw_user_meta_data?.name || version.user?.email || 'Unknown',
      user_email: version.user?.email,
      user_avatar: version.user?.raw_user_meta_data?.avatar_url,
    }));

    logger.logResponse('GET', `/api/notes/${noteId}/versions`, 200, Date.now() - startTime);
    return NextResponse.json({ versions: formattedVersions });
  } catch (_error) {
    logger.logResponse('GET', `/api/notes/${noteId}/versions`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes/[id]/versions - Create a manual version snapshot
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const noteId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { change_description } = body;

    // Get current note data
    const { data: note } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (!note) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.user_id !== user.id) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get next version number
    const { data: latestVersion } = await supabase
      .from('note_versions')
      .select('version_number')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const versionNumber = (latestVersion?.version_number || 0) + 1;

    // Create manual snapshot
    const { data: version, error } = await supabase
      .from('note_versions')
      .insert({
        note_id: noteId,
        user_id: user.id,
        version_number: versionNumber,
        original_notes: note.original_notes,
        summary: note.summary,
        takeaways: note.takeaways,
        actions: note.actions,
        tags: note.tags,
        sentiment: note.sentiment,
        change_description: change_description || 'Manual snapshot',
        snapshot_type: 'manual',
      })
      .select()
      .single();

    if (error) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions`, 500, Date.now() - startTime);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.logResponse('POST', `/api/notes/${noteId}/versions`, 201, Date.now() - startTime);
    return NextResponse.json({ version }, { status: 201 });
  } catch (_error) {
    logger.logResponse('POST', `/api/notes/${noteId}/versions`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
