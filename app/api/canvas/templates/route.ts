import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';

// GET /api/canvas/templates - List templates
export async function GET(req: NextRequest) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();

  try {
    const supabase = await getServerSupabase();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.logResponse('GET', '/api/canvas/templates', 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    let templates;

    if (search) {
      // Use search function
      const { data, error } = await supabase.rpc('search_canvas_templates', {
        p_user_id: user.id,
        p_query: search,
        p_category: category,
        p_limit: limit,
      });

      if (error) throw error;
      templates = data;
    } else if (featured || category) {
      // Use popular templates function
      const { data, error } = await supabase.rpc('get_popular_templates', {
        p_user_id: user.id,
        p_category: category,
        p_limit: limit,
      });

      if (error) throw error;
      templates = data;
    } else {
      // Direct query for all accessible templates
      const query = supabase
        .from('canvas_templates')
        .select('id, name, description, category, thumbnail_url, use_count, creator_id, is_public, is_featured, is_system, created_at, updated_at')
        .order('is_featured', { ascending: false })
        .order('use_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data, error } = await query;

      if (error) throw error;
      templates = data;
    }

    logger.logResponse('GET', '/api/canvas/templates', 200, Date.now() - startTime);
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    logger.logResponse('GET', '/api/canvas/templates', 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/canvas/templates - Create new template
export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();

  try {
    const supabase = await getServerSupabase();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.logResponse('POST', '/api/canvas/templates', 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      category = 'custom',
      nodes,
      edges,
      viewport,
      thumbnail_url,
      color_scheme,
      workspace_id,
      is_public = false,
      tags = [],
    } = body;

    // Validation
    if (!name || !name.trim()) {
      logger.logResponse('POST', '/api/canvas/templates', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!nodes || !Array.isArray(nodes)) {
      logger.logResponse('POST', '/api/canvas/templates', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Nodes array is required' }, { status: 400 });
    }

    if (!edges || !Array.isArray(edges)) {
      logger.logResponse('POST', '/api/canvas/templates', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Edges array is required' }, { status: 400 });
    }

    // Check workspace access if workspace_id provided
    if (workspace_id) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        logger.logResponse('POST', '/api/canvas/templates', 403, Date.now() - startTime);
        return NextResponse.json(
          { error: 'You do not have access to this workspace' },
          { status: 403 }
        );
      }
    }

    // Create template
    const { data: template, error: createError } = await supabase
      .from('canvas_templates')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 },
        thumbnail_url: thumbnail_url || null,
        color_scheme: color_scheme || 'default',
        creator_id: user.id,
        workspace_id: workspace_id || null,
        is_public,
        tags,
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create template:', createError);
      logger.logResponse('POST', '/api/canvas/templates', 500, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    logger.logResponse('POST', '/api/canvas/templates', 201, Date.now() - startTime);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Template creation error:', error);
    logger.logResponse('POST', '/api/canvas/templates', 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
