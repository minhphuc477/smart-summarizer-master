import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET: Lấy danh sách workspaces của user
export async function GET() {
  try {
    const supabase = await getServerSupabase();
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to use the secure RPC function first
    let { data: workspaces, error } = await supabase
      .rpc('get_user_workspaces');

    // Fallback: if RPC function doesn't exist, use simple direct query
    if (error && (error.message?.includes('function') || error.code === '42883')) {
      console.log('RPC function not found, using direct query fallback');
      
      // Get workspace IDs the user is a member of
      const { data: membershipData, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id);
      
      if (membershipError) {
        console.error('Error fetching workspace memberships:', membershipError);
        return NextResponse.json({ error: membershipError.message }, { status: 500 });
      }

      const workspaceIds = membershipData?.map(m => m.workspace_id) || [];
      
      if (workspaceIds.length === 0) {
        // User is not a member of any workspaces
        return NextResponse.json({ workspaces: [] });
      }

      // Get workspace details
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, name, description, owner_id, created_at, updated_at')
        .in('id', workspaceIds)
        .order('created_at', { ascending: false });
      
      if (workspaceError) {
        console.error('Error fetching workspaces:', workspaceError);
        return NextResponse.json({ error: workspaceError.message }, { status: 500 });
      }

      workspaces = workspaceData;
      error = null;
    }

    if (error) {
      console.error('Error fetching workspaces:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspaces: workspaces || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Tạo workspace mới
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Workspace name too long (max 100 characters)' },
        { status: 400 }
      );
    }

    // Create workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
