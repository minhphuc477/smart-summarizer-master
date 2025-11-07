import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

type Params = {
  params: Promise<{
    shareId: string;
  }>;
};

// GET: Lấy public note by share_id (không cần auth)
export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  const { shareId } = params;
  try {
    const supabase = await getServerSupabase();

    // Fetch public note
    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_public', true)
      .single();

    if (error) {
      console.error('Error fetching shared note:', error);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!note) {
      return NextResponse.json({ error: 'Note not found or not public' }, { status: 404 });
    }

    // Return note data (không bao gồm sensitive info)
    return NextResponse.json({
      note: {
        id: note.id,
        summary: note.summary,
        takeaways: note.takeaways,
        actions: note.actions,
        tags: note.tags,
        sentiment: note.sentiment,
        created_at: note.created_at,
        // Không trả về: user_id, original_notes, workspace_id
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
