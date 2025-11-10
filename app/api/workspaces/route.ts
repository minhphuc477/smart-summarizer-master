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

      // Compute member_count, note_count, folder_count and role per workspace
      const { data: membersCount } = await supabase
        .from('workspace_members')
        .select('workspace_id, user_id', { count: 'exact', head: false })
        .in('workspace_id', workspaceIds);

      const memberMap: Record<string, number> = {};
      (membersCount as Array<{ workspace_id: string }> | null || []).forEach((m) => {
        const id = m.workspace_id;
        memberMap[id] = (memberMap[id] || 0) + 1;
      });

      const { data: folderCounts } = await supabase
        .from('folders')
        .select('workspace_id', { count: 'exact', head: false })
        .in('workspace_id', workspaceIds);

      const folderMap: Record<string, number> = {};
      (folderCounts as Array<{ workspace_id: string }> | null || []).forEach((f) => {
        const id = f.workspace_id;
        folderMap[id] = (folderMap[id] || 0) + 1;
      });

      const { data: noteCounts } = await supabase
        .from('notes')
        .select('workspace_id', { count: 'exact', head: false })
        .in('workspace_id', workspaceIds);

      const noteMap: Record<string, number> = {};
      (noteCounts as Array<{ workspace_id: string }> | null || []).forEach((n) => {
        const id = n.workspace_id;
        noteMap[id] = (noteMap[id] || 0) + 1;
      });

  const roleMap: Record<string, string> = {};
  (membershipData as Array<{ workspace_id: string; role: string }> | null || []).forEach((m) => { roleMap[m.workspace_id] = m.role; });

      workspaces = (workspaceData || []).map(w => ({
        ...w,
        role: (roleMap[w.id] as 'owner'|'admin'|'member') || 'member',
        member_count: memberMap[w.id] || 1,
        folder_count: folderMap[w.id] || 0,
        note_count: noteMap[w.id] || 0,
      }));
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
      // Surface duplicate-name constraint as a friendly conflict
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        return NextResponse.json({ error: 'You already have a workspace with this name.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message || 'Failed to create workspace' }, { status: 500 });
    }

    // Add owner as workspace member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding workspace owner as member:', memberError);
      // Workspace was created but membership failed - try to clean up
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      return NextResponse.json({ error: 'Failed to initialize workspace membership' }, { status: 500 });
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
