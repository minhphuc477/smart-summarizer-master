import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/personas/[id] - Fetch a single persona
export async function GET(
  request: NextRequest,
  props: Params
) {
  try {
    const supabase = await getServerSupabase();

    const { id } = await props.params;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the persona
    const { data: persona, error } = await supabase
      .from('personas')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching persona:', error);
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    return NextResponse.json({ persona }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/personas/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/personas/[id] - Update a persona
export async function PATCH(
  request: NextRequest,
  props: Params
) {
  try {
    const supabase = await getServerSupabase();

    const { id } = await props.params;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { name, prompt, description, is_default } = body;

  // Build update object
  const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (prompt !== undefined) updates.prompt = prompt;
    if (description !== undefined) updates.description = description;
    if (is_default !== undefined) updates.is_default = is_default;

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from('personas')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .neq('id', id);
    }

    // Update the persona
    const { data: persona, error } = await supabase
      .from('personas')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating persona:', error);
      return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
    }

    return NextResponse.json({ persona }, { status: 200 });
  } catch (error) {
    console.error('Error in PATCH /api/personas/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/personas/[id] - Delete a persona
export async function DELETE(
  request: NextRequest,
  props: Params
) {
  try {
    const supabase = await getServerSupabase();

    const { id } = await props.params;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the persona
    const { error } = await supabase
      .from('personas')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting persona:', error);
      return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in DELETE /api/personas/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
