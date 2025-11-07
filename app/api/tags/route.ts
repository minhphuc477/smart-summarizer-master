import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

// GET: Fetch all tags for autocomplete (user's tags or all public tags)
export async function GET(request: NextRequest) {
  try {
  const supabase = await getServerSupabase();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    let tagsQuery = supabase
      .from('tags')
      .select('id, name')
      .order('name');

    if (query.trim()) {
      tagsQuery = tagsQuery.ilike('name', `%${query.trim()}%`);
    }

    const { data: tags, error } = await tagsQuery.limit(20);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    return NextResponse.json({ tags: tags || [] });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
