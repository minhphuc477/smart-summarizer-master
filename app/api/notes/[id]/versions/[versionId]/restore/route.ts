import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * POST /api/notes/[id]/versions/[versionId]/restore - Restore a previous version
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const { id: noteId, versionId } = params;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions/${versionId}/restore`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the version to restore
    const { data: version } = await supabase
      .from('note_versions')
      .select('*')
      .eq('id', versionId)
      .eq('note_id', noteId)
      .single();

    if (!version) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions/${versionId}/restore`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Verify note ownership
    const { data: note } = await supabase
      .from('notes')
      .select('user_id')
      .eq('id', noteId)
      .single();

    if (!note || note.user_id !== user.id) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions/${versionId}/restore`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Restore the note to this version
    const { data: restored, error: restoreError } = await supabase
      .from('notes')
      .update({
        original_notes: version.original_notes,
        summary: version.summary,
        takeaways: version.takeaways,
        actions: version.actions,
        tags: version.tags,
        sentiment: version.sentiment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single();

    if (restoreError) {
      logger.logResponse('POST', `/api/notes/${noteId}/versions/${versionId}/restore`, 500, Date.now() - startTime);
      return NextResponse.json({ error: restoreError.message }, { status: 500 });
    }

    // Create a new version entry marking this as a restore
    const { data: latestVersion } = await supabase
      .from('note_versions')
      .select('version_number')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const newVersionNumber = (latestVersion?.version_number || 0) + 1;

    await supabase
      .from('note_versions')
      .insert({
        note_id: noteId,
        user_id: user.id,
        version_number: newVersionNumber,
        original_notes: version.original_notes,
        summary: version.summary,
        takeaways: version.takeaways,
        actions: version.actions,
        tags: version.tags,
        sentiment: version.sentiment,
        change_description: `Restored to version ${version.version_number}`,
        snapshot_type: 'restore',
        parent_version_id: parseInt(versionId),
      });

    logger.logResponse('POST', `/api/notes/${noteId}/versions/${versionId}/restore`, 200, Date.now() - startTime);
    return NextResponse.json({ note: restored, version: newVersionNumber });
  } catch (_error) {
    logger.logResponse('POST', `/api/notes/${noteId}/versions/${versionId}/restore`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
