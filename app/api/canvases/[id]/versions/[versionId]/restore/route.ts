import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const canvasId = params.id;
  const versionId = params.versionId;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.logResponse('POST', `/api/canvases/${canvasId}/versions/${versionId}/restore`, 401, Date.now() - start);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: canvas } = await supabase
      .from('canvases')
      .select('id, user_id')
      .eq('id', canvasId)
      .single();

    if (!canvas || canvas.user_id !== user.id) {
      logger.logResponse('POST', `/api/canvases/${canvasId}/versions/${versionId}/restore`, 403, Date.now() - start);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get version
    const { data: version } = await supabase
      .from('canvas_versions')
      .select('*')
      .eq('id', versionId)
      .eq('canvas_id', canvasId)
      .single();

    if (!version) {
      logger.logResponse('POST', `/api/canvases/${canvasId}/versions/${versionId}/restore`, 404, Date.now() - start);
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Canvas versions store nodes, edges, title, description directly (not in snapshot_data)
    const nodes = version.nodes || [];
    const edges = version.edges || [];

    // Update canvas metadata
    await supabase
      .from('canvases')
      .update({
        title: version.title ?? null,
        description: version.description ?? null,
      })
      .eq('id', canvasId);

    // Replace nodes
    await supabase
      .from('canvas_nodes')
      .delete()
      .eq('canvas_id', canvasId);

    if (nodes.length) {
      await supabase
        .from('canvas_nodes')
        .insert(nodes.map((n: object) => ({ canvas_id: canvasId, ...n })));
    }

    // Replace edges
    await supabase
      .from('canvas_edges')
      .delete()
      .eq('canvas_id', canvasId);

    if (edges.length) {
      await supabase
        .from('canvas_edges')
        .insert(edges.map((e: object) => ({ canvas_id: canvasId, ...e })));
    }

    logger.logResponse('POST', `/api/canvases/${canvasId}/versions/${versionId}/restore`, 200, Date.now() - start);
    return NextResponse.json({ success: true });
  } catch (_err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
