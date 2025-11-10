import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

type Params = { params: Promise<{ id: string }> };

// GET: Fetch single note (owner only)
export async function GET(_req: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
  const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
  .eq('user_id', user.id)
      .single();

    if (error || !note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    return NextResponse.json({ note });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update note fields (owner only)
export async function PATCH(request: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
  const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
    console.log('[PATCH /api/notes/[id]] Request body:', JSON.stringify(body, null, 2));
    
  const allowed = ['summary', 'original_notes', 'persona', 'folder_id', 'tags', 'sentiment', 'takeaways', 'actions', 'is_public', 'is_pinned'] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) if (key in body) updates[key] = body[key];
    
    console.log('[PATCH /api/notes/[id]] Updates to apply:', JSON.stringify(updates, null, 2));
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: note, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
  .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[PATCH /api/notes/[id]] Database error:', error);
      return NextResponse.json({ error: 'Failed to update note', details: error.message }, { status: 500 });
    }
    
    if (!note) {
      console.error('[PATCH /api/notes/[id]] No note returned after update');
      return NextResponse.json({ error: 'Note not found or unauthorized' }, { status: 404 });
    }
    
    console.log('[PATCH /api/notes/[id]] Success');
    return NextResponse.json({ note });
  } catch (e) {
    console.error('[PATCH /api/notes/[id]] Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE: Remove note (owner only)
export async function DELETE(_req: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
  const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
  .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
