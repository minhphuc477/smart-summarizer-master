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
  const allowed = ['summary', 'original_notes', 'persona', 'folder_id', 'tags', 'sentiment', 'takeaways', 'actions', 'is_public', 'is_pinned'] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) if (key in body) updates[key] = body[key];
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

    if (error || !note) return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    return NextResponse.json({ note });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
