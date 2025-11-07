import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

// GET /api/personas - Fetch all personas for the authenticated user
export async function GET(_request: Request) {
  try {
    const supabase = await getServerSupabase();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch personas for the user
    const { data: personas, error } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching personas:', error);
      return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });
    }

    return NextResponse.json({ personas }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/personas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/personas - Create a new persona
export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();

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

    // Validate required fields
    if (!name || !prompt) {
      return NextResponse.json(
        { error: 'Name and prompt are required' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from('personas')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    // Create new persona
    const { data: persona, error } = await supabase
      .from('personas')
      .insert({
        user_id: user.id,
        name,
        prompt,
        description: description || null,
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating persona:', error);
      return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
    }

    return NextResponse.json({ persona }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/personas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
