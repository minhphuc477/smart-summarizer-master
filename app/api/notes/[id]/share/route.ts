import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import crypto from 'crypto';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// PATCH: Toggle public sharing for a note
export async function PATCH(request: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
  const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { isPublic } = body;

    if (typeof isPublic !== 'boolean') {
      return NextResponse.json(
        { error: 'isPublic must be a boolean' },
        { status: 400 }
      );
    }

    // If enabling public share, ensure a persistent share_id exists
  const updatePayload: Record<string, unknown> = { is_public: isPublic };
    if (isPublic) {
      const { data: existing, error: readErr } = await supabase
        .from('notes')
        .select('share_id')
        .eq('id', id)
  .eq('user_id', user.id)
        .single();
      if (readErr) {
        console.error('Error reading note before share:', readErr);
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      if (!existing?.share_id) {
        updatePayload.share_id = crypto.randomUUID();
      }
    }

    // Update note with share state (and possibly share_id)
    const { data: note, error } = await supabase
      .from('notes')
      .update(updatePayload)
      .eq('id', id)
  .eq('user_id', user.id) // Only owner can change
      .select()
      .single();

    if (error) {
      console.error('Error updating note:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
