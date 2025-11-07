import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET: Get single folder by ID
export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
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

    const { data: folder, error } = await supabase
      .from('folder_stats')
      .select('*')
      .eq('id', params.id)
  .eq('user_id', user.id)
      .single();

    if (error || !folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ folder });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Update folder
export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
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
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return NextResponse.json(
          { error: "Folder name cannot be empty" },
          { status: 400 }
        );
      }
      if (name.length > 100) {
        return NextResponse.json(
          { error: "Folder name is too long" },
          { status: 400 }
        );
      }
    }

  // Build update object
  const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (color !== undefined) updates.color = color;

    // Update folder
    const { data: folder, error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', params.id)
  .eq('user_id', user.id)
      .select()
      .single();

    if (error || !folder) {
      console.error('Error updating folder:', error);
      return NextResponse.json(
        { error: "Failed to update folder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ folder });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete folder
export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
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

    // Delete folder (notes will have folder_id set to NULL due to ON DELETE SET NULL)
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', params.id)
  .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting folder:', error);
      return NextResponse.json(
        { error: "Failed to delete folder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
