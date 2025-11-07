import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

type Params = { params: Promise<{ id: string }> };

// POST: Add tag to note
export async function POST(request: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
  const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tagName } = await request.json();
    if (!tagName || !tagName.trim()) {
      return NextResponse.json({ error: 'Tag name required' }, { status: 400 });
    }

    // Verify note ownership
    const { data: note } = await supabase
      .from('notes')
      .select('id')
      .eq('id', id)
  .eq('user_id', user.id)
      .single();
    
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    // Get or create tag
    let { data: tag } = await supabase
  .from('tags')
  .select('id, name')
  .eq('name', tagName.trim().toLowerCase())
      .single();

    if (!tag) {
      const { data: newTag, error: tagError } = await supabase
  .from('tags')
  .insert({ name: tagName.trim().toLowerCase(), user_id: user.id })
        .select()
        .single();
      
      if (tagError || !newTag) {
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
      }
      tag = newTag;
    }

    // Ensure tag is not null before using it
    if (!tag) {
      return NextResponse.json({ error: 'Failed to get or create tag' }, { status: 500 });
    }

    // Link tag to note (ignore duplicate)
    const { error: linkError } = await supabase
      .from('note_tags')
      .insert({ note_id: parseInt(id), tag_id: tag.id })
      .select();

    if (linkError && !linkError.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Failed to link tag' }, { status: 500 });
    }

    return NextResponse.json({ tag, success: true });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove tag from note
export async function DELETE(request: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
  const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');
    
    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID required' }, { status: 400 });
    }

    // Verify note ownership
    const { data: note } = await supabase
      .from('notes')
      .select('id')
      .eq('id', id)
  .eq('user_id', user.id)
      .single();
    
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    // Remove tag link
    const { error } = await supabase
      .from('note_tags')
      .delete()
      .eq('note_id', parseInt(id))
      .eq('tag_id', parseInt(tagId));

    if (error) {
      return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
