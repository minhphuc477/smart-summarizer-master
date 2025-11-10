import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const canvasId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.logResponse('GET', `/api/canvases/${canvasId}/versions`, 401, Date.now() - start);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: canvas } = await supabase
      .from('canvases')
      .select('id, user_id')
      .eq('id', canvasId)
      .single();

    if (!canvas) {
      logger.logResponse('GET', `/api/canvases/${canvasId}/versions`, 404, Date.now() - start);
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    if (canvas.user_id !== user.id) {
      logger.logResponse('GET', `/api/canvases/${canvasId}/versions`, 403, Date.now() - start);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get versions - user info will be basic as we can't join auth.users directly
    const { data: versions, error } = await supabase
      .from('canvas_versions')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('[GET /api/canvases/[id]/versions] Error fetching versions:', error);
      logger.logResponse('GET', `/api/canvases/${canvasId}/versions`, 500, Date.now() - start);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format versions with basic user info (user_id only, since we can't easily join auth.users)
    const formatted = (versions || []).map(v => ({
      ...v,
      user_name: v.user_id === user.id ? 'You' : 'Collaborator',
      user_email: v.user_id === user.id ? user.email : undefined,
      user_avatar: undefined,
    }));

    logger.logResponse('GET', `/api/canvases/${canvasId}/versions`, 200, Date.now() - start);
    return NextResponse.json({ versions: formatted });
  } catch (err) {
    console.error('[GET /api/canvases/[id]/versions] Error:', err);
    logger.logResponse('GET', `/api/canvases/${canvasId}/versions`, 500, Date.now() - start);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const canvasId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.logResponse('POST', `/api/canvases/${canvasId}/versions`, 401, Date.now() - start);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const change_description: string | undefined = body.change_description;

    // Ownership check
    const { data: canvas } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (!canvas || canvas.user_id !== user.id) {
      logger.logResponse('POST', `/api/canvases/${canvasId}/versions`, 403, Date.now() - start);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get nodes and edges
    const { data: nodes } = await supabase
      .from('canvas_nodes')
      .select('*')
      .eq('canvas_id', canvasId);

    const { data: edges } = await supabase
      .from('canvas_edges')
      .select('*')
      .eq('canvas_id', canvasId);

    // Next version number
    const { data: latest } = await supabase
      .from('canvas_versions')
      .select('version_number')
      .eq('canvas_id', canvasId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const version_number = (latest?.version_number || 0) + 1;

    const { data: version, error } = await supabase
      .from('canvas_versions')
      .insert({
        canvas_id: canvasId,
        user_id: user.id,
        version_number,
        nodes: nodes || [],
        edges: edges || [],
        title: canvas.title,
        description: canvas.description,
        snapshot_type: 'manual',
        change_description: change_description || 'Manual snapshot',
        nodes_added: 0,
        nodes_removed: 0,
        nodes_modified: (nodes || []).length,
        edges_added: 0,
        edges_removed: 0,
      })
      .select()
      .single();

    if (error) {
      logger.logResponse('POST', `/api/canvases/${canvasId}/versions`, 500, Date.now() - start);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.logResponse('POST', `/api/canvases/${canvasId}/versions`, 201, Date.now() - start);
    return NextResponse.json({ version }, { status: 201 });
  } catch (_err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
