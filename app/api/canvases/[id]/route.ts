import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET: Lấy canvas data (nodes + edges)
export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    // Get canvas
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', id)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    // Check if public or user has access
    if (!canvas.is_public && (!user || canvas.user_id !== user.id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get nodes
    const { data: nodes } = await supabase
      .from('canvas_nodes')
      .select('*')
      .eq('canvas_id', id);

    // Get edges
    const { data: edges } = await supabase
      .from('canvas_edges')
      .select('*')
      .eq('canvas_id', id);

    return NextResponse.json({
      canvas,
      nodes: nodes || [],
      edges: edges || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update canvas
export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { title, description, nodes, edges, is_public } = body;

    // Update canvas metadata
  const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (is_public !== undefined) updateData.is_public = is_public;

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('canvases')
        .update(updateData)
        .eq('id', id);
    }

    // Update nodes if provided
    if (nodes && Array.isArray(nodes)) {
      // Delete existing nodes
      await supabase
        .from('canvas_nodes')
        .delete()
        .eq('canvas_id', id);

      // Insert new nodes
      if (nodes.length > 0) {
        await supabase
          .from('canvas_nodes')
          .insert(nodes.map((node: Record<string, unknown>) => ({
            canvas_id: id,
            ...node,
          })));
      }
    }

    // Update edges if provided
    if (edges && Array.isArray(edges)) {
      // Delete existing edges
      await supabase
        .from('canvas_edges')
        .delete()
        .eq('canvas_id', id);

      // Insert new edges
      if (edges.length > 0) {
        await supabase
          .from('canvas_edges')
          .insert(edges.map((edge: Record<string, unknown>) => ({
            canvas_id: id,
            ...edge,
          })));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Xóa canvas
export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('canvases')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting canvas:', error);
      return NextResponse.json({ error: String((error as { message?: string }).message || 'Error') }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
