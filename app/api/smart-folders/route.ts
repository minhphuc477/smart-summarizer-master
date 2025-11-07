import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * GET /api/smart-folders
 * List all smart folders for the current user
 */
export async function GET(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('Unauthorized access to smart folders');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');

    let query = supabase
      .from('smart_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data: folders, error } = await query;

    if (error) {
      logger.error('Failed to fetch smart folders', error as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch smart folders' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.info('Smart folders fetched', undefined, { count: folders?.length || 0, duration });
    logger.logResponse('GET', '/api/smart-folders', 200, duration);

    return NextResponse.json({ folders: folders || [], count: folders?.length || 0 });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error fetching smart folders', error as Error);
    logger.logResponse('GET', '/api/smart-folders', 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/smart-folders
 * Create a new smart folder
 * Body: { name, description?, icon?, color?, rules, auto_assign?, workspace_id? }
 */
export async function POST(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('Unauthorized attempt to create smart folder');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, icon, color, rules, auto_assign = true, workspace_id } = body;

    if (!name || !rules) {
      logger.warn('Missing required fields for smart folder');
      return NextResponse.json({ error: 'name and rules are required' }, { status: 400 });
    }

    // Validate rules structure
    if (typeof rules !== 'object' || (!rules.keywords && !rules.tags)) {
      logger.warn('Invalid rules structure');
      return NextResponse.json({ 
        error: 'rules must contain keywords or tags arrays' 
      }, { status: 400 });
    }

    const { data: folder, error } = await supabase
      .from('smart_folders')
      .insert({
        user_id: user.id,
        workspace_id: workspace_id || null,
        name,
        description: description || null,
        icon: icon || '🤖',
        color: color || '#3b82f6',
        rules,
        auto_assign
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('unique_smart_folder_name')) {
        logger.warn('Smart folder name already exists');
        return NextResponse.json({ error: 'A smart folder with this name already exists' }, { status: 409 });
      }
      logger.error('Failed to create smart folder', error as unknown as Error);
      return NextResponse.json({ error: 'Failed to create smart folder' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.info('Smart folder created', undefined, { folderId: folder.id, name, duration });
    logger.logResponse('POST', '/api/smart-folders', 201, duration);

    return NextResponse.json({ success: true, folder }, { status: 201 });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error creating smart folder', error as Error);
    logger.logResponse('POST', '/api/smart-folders', 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
