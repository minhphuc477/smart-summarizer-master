import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { getGroqSummary } from '@/lib/groq';

// Next.js type generation (15.5.x) expects the context.params to be a Promise for dynamic routes.
type Params = { params: Promise<{ id: string }> };

// POST: Analyze a note's content to (re)generate tags and sentiment (owner only)
export async function POST(_req: NextRequest, props: Params) {
  const { id } = await props.params;
  const supabase = await getServerSupabase();

  try {
    // Use authenticated user resolution (more secure than getSession storage)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Load note content
    const { data: note, error: noteErr } = await supabase
      .from('notes')
      .select('id, original_notes, persona, user_id')
      .eq('id', id)
  .eq('user_id', user.id)
      .single();

    if (noteErr || !note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    if (!note.original_notes) {
      return NextResponse.json({ error: 'Note has no original content to analyze' }, { status: 400 });
    }

    // Use Groq to analyze content; reuse summary pipeline but only apply tags/sentiment updates
    const ai = await getGroqSummary(note.original_notes, note.persona || '');
    const tags: string[] = Array.isArray(ai.tags) ? ai.tags : [];
    const sentiment: string | null = typeof ai.sentiment === 'string' ? ai.sentiment : null;

    // Update only sentiment (tags stored via note_tags linkage; avoid missing column error)
    const { data: updated, error: upErr } = await supabase
      .from('notes')
      .update({ sentiment })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (upErr || !updated) return NextResponse.json({ error: 'Failed to update analysis' }, { status: 500 });

    // Optional: maintain tag taxonomy and note_tags linkage (best-effort)
    try {
      for (const tagName of tags) {
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .eq('user_id', user.id)
          .single();

        let tagId: number | null = existingTag?.id ?? null;
        if (!tagId) {
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ name: tagName, user_id: user.id })
            .select()
            .single();
          tagId = newTag?.id ?? null;
        }
        if (tagId) {
          await supabase
            .from('note_tags')
            .upsert({ note_id: updated.id, tag_id: tagId }, { onConflict: 'note_id,tag_id' });
        }
      }
    } catch (e) {
      // Non-fatal; taxonomy sync errors should not block main response
      console.warn('Tag taxonomy sync warning:', e);
    }

    return NextResponse.json({ note: updated, tags, sentiment });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
