import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// PATCH: Move note to folder (or remove from folder)
export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const supabase = await getServerSupabase();
    // Secure user retrieval
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { folder_id } = body;

    // If folder_id is provided, verify it exists and belongs to user
    if (folder_id !== null && folder_id !== undefined) {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folder_id)
  .eq('user_id', user.id)
        .single();

      if (folderError || !folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }
    }

    // Update note's folder_id
    const { data: note, error } = await supabase
      .from('notes')
      .update({ folder_id: folder_id === null ? null : folder_id })
      .eq('id', params.id)
  .eq('user_id', user.id)
      .select()
      .single();

    if (error || !note) {
      console.error('Error updating note folder:', error);
      return NextResponse.json(
        { error: "Failed to update note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ note });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
