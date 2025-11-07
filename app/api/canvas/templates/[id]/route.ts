import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';

// GET /api/canvas/templates/[id] - Get template details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();

  try {
    const [supabase, { id }] = await Promise.all([getServerSupabase(), params]);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.logResponse('GET', `/api/canvas/templates/${id}`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch template (RLS will handle access control)
    const { data: template, error: fetchError } = await supabase
      .from('canvas_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !template) {
      logger.logResponse('GET', `/api/canvas/templates/${id}`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Record usage
    const { searchParams } = new URL(req.url);
    const recordUsage = searchParams.get('record_usage') === 'true';

    if (recordUsage) {
      // Increment use count
      await supabase.rpc('increment_template_use_count', {
        p_template_id: id,
      });

      // Record in usage table (ignore errors like duplicate usage)
      await supabase.from('canvas_template_usage').insert({
        template_id: id,
        user_id: user.id,
      });
    }

    logger.logResponse('GET', `/api/canvas/templates/${id}`, 200, Date.now() - startTime);
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    const { id } = await params;
    logger.logResponse('GET', `/api/canvas/templates/${id}`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/canvas/templates/[id] - Update template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();

  try {
    const [supabase, { id }] = await Promise.all([getServerSupabase(), params]);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.logResponse('PUT', `/api/canvas/templates/${id}`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      category,
      nodes,
      edges,
      viewport,
      thumbnail_url,
      color_scheme,
      is_public,
      tags,
    } = body;

    // Build update object (only include provided fields)
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (category !== undefined) updates.category = category;
    if (nodes !== undefined) updates.nodes = nodes;
    if (edges !== undefined) updates.edges = edges;
    if (viewport !== undefined) updates.viewport = viewport;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;
    if (color_scheme !== undefined) updates.color_scheme = color_scheme;
    if (is_public !== undefined) updates.is_public = is_public;
    if (tags !== undefined) updates.tags = tags;

    if (Object.keys(updates).length === 0) {
      logger.logResponse('PUT', `/api/canvas/templates/${id}`, 400, Date.now() - startTime);
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update template (RLS will ensure user owns it)
    const { data: template, error: updateError } = await supabase
      .from('canvas_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !template) {
      console.error('Failed to update template:', updateError);
      logger.logResponse('PUT', `/api/canvas/templates/${id}`, 404, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Template not found or you do not have permission to update it' },
        { status: 404 }
      );
    }

    logger.logResponse('PUT', `/api/canvas/templates/${id}`, 200, Date.now() - startTime);
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Template update error:', error);
    const { id } = await params;
    logger.logResponse('PUT', `/api/canvas/templates/${id}`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/canvas/templates/[id] - Delete template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();

  try {
    const [supabase, { id }] = await Promise.all([getServerSupabase(), params]);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.logResponse('DELETE', `/api/canvas/templates/${id}`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete template (RLS will ensure user owns it and it's not a system template)
    const { error: deleteError } = await supabase
      .from('canvas_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete template:', deleteError);
      logger.logResponse('DELETE', `/api/canvas/templates/${id}`, 404, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Template not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }

    logger.logResponse('DELETE', `/api/canvas/templates/${id}`, 200, Date.now() - startTime);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template deletion error:', error);
    const { id } = await params;
    logger.logResponse('DELETE', `/api/canvas/templates/${id}`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
