import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids : null;
    if (!ids || ids.length === 0) return NextResponse.json({ error: 'No ids provided' }, { status: 400 });

    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    console.log(`[POST /api/notes/bulk-delete] Deleting ${ids.length} note(s) for user ${user.id}`);

    // First, delete related note_tags to avoid foreign key constraint violations
    const { error: tagsError } = await supabase
      .from('note_tags')
      .delete()
      .in('note_id', ids);

    if (tagsError) {
      console.error('[POST /api/notes/bulk-delete] Failed to delete note_tags:', tagsError);
      // Continue anyway - tags might not exist
    }

    // Now delete the notes (scoped to the authenticated user for security)
    const { error, count } = await supabase
      .from('notes')
      .delete({ count: 'exact' })
      .in('id', ids)
      .eq('user_id', user.id);

    if (error) {
      console.error('[POST /api/notes/bulk-delete] Database error:', error);
      return NextResponse.json({ error: 'Failed to delete notes', details: error.message }, { status: 500 });
    }

    // Use count returned by Supabase
    const deletedCount = count ?? ids.length; // Fallback to requested count if count not available
    console.log(`[POST /api/notes/bulk-delete] Successfully deleted ${deletedCount} note(s)`);
    return NextResponse.json({ success: true, deletedCount });
  } catch (e) {
    console.error('[POST /api/notes/bulk-delete] Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
