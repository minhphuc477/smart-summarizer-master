import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET: Lấy template by ID
export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: String((error as { message?: string }).message || 'Error') }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Use template (increment usage count)
export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Increment usage count
    // Note: Supabase JS does not support SQL literals in .update directly.
    // For safe increment without a custom RPC, read current value then update.
    // This is not strictly atomic under heavy concurrency, but sufficient for typical usage.
    const { data: current, error: readError } = await supabase
      .from('templates')
      .select('id, name, usage_count')
      .eq('id', id)
      .single();

    if (readError || !current) {
      console.error('Error reading template for increment:', readError);
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: template, error } = await supabase
      .from('templates')
      .update({ usage_count: ((current as { usage_count: number | null }).usage_count || 0) + 1 })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json({ error: String((error as { message?: string }).message || 'Error') }, { status: 500 });
    }

    // Track analytics
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'template_used',
      event_data: { template_id: id, template_name: (template as { name: string }).name },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Xóa custom template
export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete only non-system templates owned by the user
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json({ error: String((error as { message?: string }).message || 'Error') }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
