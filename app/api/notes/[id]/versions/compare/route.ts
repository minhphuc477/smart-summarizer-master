import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * GET /api/notes/[id]/versions/compare?v1=X&v2=Y - Compare two versions
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const noteId = params.id;
  const searchParams = req.nextUrl.searchParams;
  const version1 = searchParams.get('v1');
  const version2 = searchParams.get('v2');

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions/compare`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!version1 || !version2) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions/compare`, 400, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Both v1 and v2 parameters are required' },
        { status: 400 }
      );
    }

    // Verify note ownership
    const { data: note } = await supabase
      .from('notes')
      .select('user_id')
      .eq('id', noteId)
      .single();

    if (!note || note.user_id !== user.id) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions/compare`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get both versions
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
      .in('id', [version1, version2]);

    if (error || !versions || versions.length !== 2) {
      logger.logResponse('GET', `/api/notes/${noteId}/versions/compare`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Versions not found' }, { status: 404 });
    }

    const [v1, v2] = versions.sort((a, b) => a.version_number - b.version_number);

    // Calculate differences
    const diff = {
      version1: {
        id: v1.id,
        version_number: v1.version_number,
        created_at: v1.created_at,
        user_name: v1.user?.raw_user_meta_data?.name || v1.user?.email || 'Unknown',
        snapshot_type: v1.snapshot_type,
      },
      version2: {
        id: v2.id,
        version_number: v2.version_number,
        created_at: v2.created_at,
        user_name: v2.user?.raw_user_meta_data?.name || v2.user?.email || 'Unknown',
        snapshot_type: v2.snapshot_type,
      },
      changes: {
        original_notes: {
          old: v1.original_notes,
          new: v2.original_notes,
          changed: v1.original_notes !== v2.original_notes,
        },
        summary: {
          old: v1.summary,
          new: v2.summary,
          changed: v1.summary !== v2.summary,
        },
        takeaways: {
          old: v1.takeaways,
          new: v2.takeaways,
          changed: JSON.stringify(v1.takeaways) !== JSON.stringify(v2.takeaways),
          added: v2.takeaways?.filter((t: string) => !v1.takeaways?.includes(t)) || [],
          removed: v1.takeaways?.filter((t: string) => !v2.takeaways?.includes(t)) || [],
        },
        actions: {
          old: v1.actions,
          new: v2.actions,
          changed: JSON.stringify(v1.actions) !== JSON.stringify(v2.actions),
        },
        tags: {
          old: v1.tags,
          new: v2.tags,
          changed: JSON.stringify(v1.tags) !== JSON.stringify(v2.tags),
          added: v2.tags?.filter((t: string) => !v1.tags?.includes(t)) || [],
          removed: v1.tags?.filter((t: string) => !v2.tags?.includes(t)) || [],
        },
        sentiment: {
          old: v1.sentiment,
          new: v2.sentiment,
          changed: v1.sentiment !== v2.sentiment,
        },
      },
    };

    logger.logResponse('GET', `/api/notes/${noteId}/versions/compare`, 200, Date.now() - startTime);
    return NextResponse.json({ diff });
  } catch (_error) {
    logger.logResponse('GET', `/api/notes/${noteId}/versions/compare`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
