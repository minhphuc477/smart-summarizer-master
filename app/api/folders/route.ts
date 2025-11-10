import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";

// GET: List all folders for current user
// POST: Create new folder
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase();
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('🔍 Folders API - Auth Check:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message,
    });
    
    if (authError || !user) {
      console.log('❌ Folders API - Unauthorized:', authError?.message || 'No user');
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get workspace_id from query parameters
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    console.log('🔍 Folders API - Query params:', {
      workspaceId,
      url: request.url,
    });

    // Build query
    let query = supabase
      .from('folders')
      .select(`
        id,
        name,
        description,
        color,
        user_id,
        workspace_id,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id);

    // Filter by workspace if specified
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    } else {
      // If no workspace specified, only show personal folders (workspace_id is null)
      query = query.is('workspace_id', null);
    }

    const { data: folders, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching folders:', error);
      return NextResponse.json(
        { error: "Failed to fetch folders" },
        { status: 500 }
      );
    }

    console.log('✅ Folders API - Success:', {
      folderCount: folders?.length,
      workspaceId,
    });

    return NextResponse.json({ folders: folders || [] });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, color } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Folder name is too long (max 100 characters)" },
        { status: 400 }
      );
    }

    // Create folder
    const { data: folder, error } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#3B82F6',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating folder:', error);
      return NextResponse.json(
        { error: "Failed to create folder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ folder }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
