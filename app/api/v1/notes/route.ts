/**
 * Public API v1: Notes Endpoint
 * 
 * GET  /api/v1/notes - List notes (paginated, filtered)
 * POST /api/v1/notes - Create a new note
 * 
 * Authentication: Required (API key)
 * Rate limit: Based on user tier
 */

import { NextResponse } from 'next/server';
import { withSessionOrApiKey } from '@/lib/apiAuth';
import { requireScope } from '@/lib/apiMiddleware';
import { getServerSupabase } from '@/lib/supabaseServer';

export const GET = withSessionOrApiKey(async (req, context) => {
  // Require read scope
  try { requireScope(context.scopes, 'read'); } catch (e: unknown) {
    const error = e as Error;
    return NextResponse.json({ error: 'Forbidden', code: 'AUTH_REQUIRED', details: error?.message }, { status: 403 });
  }
  
  // Parse query parameters
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100 per page
  const folder_id = searchParams.get('folder_id');
  const tag = searchParams.get('tag');
  const sentiment = searchParams.get('sentiment');
  const search = searchParams.get('search');
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';
  
  // Validate sort and order
  const validSorts = ['created_at', 'updated_at', 'summary'];
  const validOrders = ['asc', 'desc'];
  
  if (!validSorts.includes(sort)) {
    return NextResponse.json(
      { error: 'Invalid sort parameter', valid_values: validSorts },
      { status: 400 }
    );
  }
  
  if (!validOrders.includes(order)) {
    return NextResponse.json(
      { error: 'Invalid order parameter', valid_values: validOrders },
      { status: 400 }
    );
  }
  
  // Calculate offset
  const offset = (page - 1) * limit;
  
  try {
    // Create Supabase client with service role to access user's data
  const supabase = await getServerSupabase();
    
    // Build query
    let query = supabase
      .from('notes')
      .select('*', { count: 'exact' })
      .eq('user_id', context.userId);
    
    // Apply filters
    if (folder_id) {
      query = query.eq('folder_id', folder_id);
    }
    
    if (sentiment) {
      query = query.eq('sentiment', sentiment);
    }
    
    if (search) {
      query = query.ilike('summary', `%${search}%`);
    }
    
    // Apply tag filter (requires join)
    if (tag) {
      const { data: tagData } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tag)
        .eq('user_id', context.userId)
        .single();
      
      if (tagData) {
        const { data: noteTagsData } = await supabase
          .from('note_tags')
          .select('note_id')
          .eq('tag_id', tagData.id);
        
        if (noteTagsData && noteTagsData.length > 0) {
          const noteIds = noteTagsData.map((nt: { note_id: string }) => nt.note_id);
          query = query.in('id', noteIds);
        } else {
          // No notes with this tag
          return NextResponse.json({
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              total_pages: 0,
            },
          });
        }
      }
    }
    
    // Apply sorting and pagination
    query = query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching notes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notes', details: error.message },
        { status: 500 }
      );
    }
    
    const totalPages = count ? Math.ceil(count / limit) : 0;
    
    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      filters: {
        folder_id,
        tag,
        sentiment,
        search,
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v1/notes - Create a new note
 */
export const POST = withSessionOrApiKey(async (req, context) => {
  // Require write scope
  try { requireScope(context.scopes, 'write'); } catch (e: unknown) {
    const error = e as Error;
    return NextResponse.json({ error: 'Forbidden', code: 'AUTH_REQUIRED', details: error?.message }, { status: 403 });
  }
  
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.original_notes || typeof body.original_notes !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid field: original_notes (string required)' },
        { status: 400 }
      );
    }
    
    if (!body.summary || typeof body.summary !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid field: summary (string required)' },
        { status: 400 }
      );
    }
    
    // Optional fields validation
    const {
      original_notes,
      summary,
      takeaways = [],
      actions = [],
      tags = [],
      sentiment = 'neutral',
      persona = null,
      folder_id = null,
      workspace_id = null,
      is_public = false,
    } = body;
    
    // Validate sentiment
    const validSentiments = ['positive', 'neutral', 'negative'];
    if (!validSentiments.includes(sentiment)) {
      return NextResponse.json(
        { error: 'Invalid sentiment. Must be: positive, neutral, or negative' },
        { status: 400 }
      );
    }
    
    const supabase = await getServerSupabase();
    
    // Create the note
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: context.userId,
        original_notes,
        summary,
        takeaways,
        actions,
        sentiment,
        persona,
        folder_id,
        workspace_id,
        is_public,
      })
      .select()
      .single();
    
    if (noteError) {
      console.error('Error creating note:', noteError);
      return NextResponse.json(
        { error: 'Failed to create note', details: noteError.message },
        { status: 500 }
      );
    }
    
    // Handle tags if provided
    if (tags.length > 0) {
      for (const tagName of tags) {
        // Get or create tag
        const { data: existingTag, error: tagError } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .eq('user_id', context.userId)
          .single();
        
        let tagData = existingTag;
        if (tagError || !tagData) {
          // Create new tag
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ name: tagName, user_id: context.userId })
            .select()
            .single();
          
          tagData = newTag;
        }
        
        if (tagData) {
          // Link tag to note
          await supabase
            .from('note_tags')
            .insert({
              note_id: noteData.id,
              tag_id: tagData.id,
            });
        }
      }
    }
    
    return NextResponse.json(
      {
        data: noteData,
        message: 'Note created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
