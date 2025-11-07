import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET: Lấy danh sách members của workspace
export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id: workspaceId } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get members with user info via explicit join
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        workspace_id,
        user_id,
        role,
        invited_by,
        joined_at
      `)
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch user details separately to avoid FK relationship issues
    const membersWithUsers = await Promise.all(
      (members || []).map(async (member) => {
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, raw_user_meta_data')
          .eq('id', member.user_id)
          .single();
        
        // If users table doesn't exist, try auth.users via RPC or return basic info
        const user = userData || {
          id: member.user_id,
          email: 'Unknown',
          raw_user_meta_data: {}
        };

        return {
          ...member,
          user
        };
      })
    );

    return NextResponse.json({ members: membersWithUsers });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Mời member mới (by email)
export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id: workspaceId } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { email } = body;

    // Validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Call the invite function
    const { data, error } = await supabase.rpc('invite_to_workspace', {
      workspace_uuid: workspaceId,
      invitee_email: email.trim().toLowerCase(),
      inviter_uuid: user.id,
    });

    if (error) {
      console.error('Error inviting member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check result
    const result = data as { success: boolean; error?: string; user_id?: string };
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to invite member' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, userId: result.user_id }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Xóa member khỏi workspace
export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id: workspaceId } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Delete member (RLS sẽ check permission)
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
