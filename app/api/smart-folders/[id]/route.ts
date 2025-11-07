import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * GET /api/smart-folders/[id]
 * Get a specific smart folder with its assigned notes
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const resolvedParams = await params;

  try {
    const folderId = Number(resolvedParams.id);
    if (!folderId || Number.isNaN(folderId)) {
      logger.warn('Invalid smart folder id');
      return NextResponse.json({ error: 'Invalid smart folder id' }, { status: 400 });
    }

    const supabase = await getServerSupabase();

    // Get folder details
    const { data: folder, error: folderErr } = await supabase
      .from('smart_folders')
      .select('*')
      .eq('id', folderId)
      .single();

    if (folderErr || !folder) {
      logger.warn('Smart folder not found', undefined, { supabaseError: folderErr || null });
      return NextResponse.json({ error: 'Smart folder not found' }, { status: 404 });
    }

    // Get assigned notes
    const { data: assignments, error: assignErr } = await supabase
      .from('smart_folder_assignments')
      .select(`
        id,
        note_id,
        confidence_score,
        assigned_by,
        assigned_at,
        notes (
          id,
          summary,
          original_notes,
          created_at,
          sentiment
        )
      `)
      .eq('smart_folder_id', folderId)
      .order('confidence_score', { ascending: false });

    if (assignErr) {
      logger.error('Failed to fetch smart folder assignments', assignErr as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.info('Smart folder details fetched', undefined, { folderId, assignmentCount: assignments?.length || 0, duration });
    logger.logResponse('GET', `/api/smart-folders/${folderId}`, 200, duration);

    return NextResponse.json({ 
      folder,
      assignments: assignments || [],
      count: assignments?.length || 0
    });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error fetching smart folder', error as Error);
    logger.logResponse('GET', `/api/smart-folders/${resolvedParams?.id ?? '[id]'}`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/smart-folders/[id]
 * Update a smart folder
 * Body: { name?, description?, icon?, color?, rules?, auto_assign? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const resolvedParams = await params;

  try {
    const folderId = Number(resolvedParams.id);
    if (!folderId || Number.isNaN(folderId)) {
      logger.warn('Invalid smart folder id for update');
      return NextResponse.json({ error: 'Invalid smart folder id' }, { status: 400 });
    }

    const body = await req.json();
    const { name, description, icon, color, rules, auto_assign } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (rules !== undefined) {
      // Validate rules structure
      if (typeof rules !== 'object') {
        logger.warn('Invalid rules structure for update');
        return NextResponse.json({ error: 'rules must be an object' }, { status: 400 });
      }
      updates.rules = rules;
    }
    if (auto_assign !== undefined) updates.auto_assign = auto_assign;

    if (Object.keys(updates).length === 1) { // Only updated_at
      logger.warn('No fields to update');
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = await getServerSupabase();

    const { data: folder, error } = await supabase
      .from('smart_folders')
      .update(updates)
      .eq('id', folderId)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('unique_smart_folder_name')) {
        logger.warn('Smart folder name already exists');
        return NextResponse.json({ error: 'A smart folder with this name already exists' }, { status: 409 });
      }
      logger.error('Failed to update smart folder', error as unknown as Error);
      return NextResponse.json({ error: 'Failed to update smart folder' }, { status: 500 });
    }

    if (!folder) {
      logger.warn('Smart folder not found for update');
      return NextResponse.json({ error: 'Smart folder not found' }, { status: 404 });
    }

    const duration = Date.now() - start;
    logger.info('Smart folder updated', undefined, { folderId, duration });
    logger.logResponse('PATCH', `/api/smart-folders/${folderId}`, 200, duration);

    return NextResponse.json({ success: true, folder });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error updating smart folder', error as Error);
    logger.logResponse('PATCH', `/api/smart-folders/${resolvedParams?.id ?? '[id]'}`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/smart-folders/[id]
 * Delete a smart folder
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const resolvedParams = await params;

  try {
    const folderId = Number(resolvedParams.id);
    if (!folderId || Number.isNaN(folderId)) {
      logger.warn('Invalid smart folder id for delete');
      return NextResponse.json({ error: 'Invalid smart folder id' }, { status: 400 });
    }

    const supabase = await getServerSupabase();

    const { error } = await supabase
      .from('smart_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      logger.error('Failed to delete smart folder', error as unknown as Error);
      return NextResponse.json({ error: 'Failed to delete smart folder' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.info('Smart folder deleted', undefined, { folderId, duration });
    logger.logResponse('DELETE', `/api/smart-folders/${folderId}`, 200, duration);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error deleting smart folder', error as Error);
    logger.logResponse('DELETE', `/api/smart-folders/${resolvedParams?.id ?? '[id]'}`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
