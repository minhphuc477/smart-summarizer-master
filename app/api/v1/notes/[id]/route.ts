/**
 * Public API v1: Single Note Endpoint
 * 
 * GET    /api/v1/notes/[id] - Get a single note
 * PUT    /api/v1/notes/[id] - Update a note
 * DELETE /api/v1/notes/[id] - Delete a note
 * 
 * Authentication: Required (API key)
 * Rate limit: Based on user tier
 */

import { NextResponse } from 'next/server';
import { withApiMiddleware, requireScope } from '@/lib/apiMiddleware';
import { getServerSupabase } from '@/lib/supabaseServer';

/**
 * GET /api/v1/notes/[id] - Get a single note
 */
export const GET = withApiMiddleware(async (req, context) => {
  requireScope(context.scopes, 'read');
  
  // Extract note ID from URL
  const url = new URL(req.url);
  const noteId = url.pathname.split('/').pop();
  
  if (!noteId) {
    return NextResponse.json(
      { error: 'Note ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const supabase = await getServerSupabase();
    
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', context.userId)
      .single();
    
    if (error || !data) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    // Get tags for this note
    const { data: noteTagsData } = await supabase
      .from('note_tags')
      .select('tags(id, name)')
      .eq('note_id', noteId);
    
    type TagRow = { tags: { id: string; name: string } | null };
    const tags = (noteTagsData as TagRow[] | null)?.map((nt) => nt.tags).filter((t): t is { id: string; name: string } => Boolean(t)) || [];
    
    return NextResponse.json({
      data: {
        ...data,
        tags,
      },
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/v1/notes/[id] - Update a note
 */
export const PUT = withApiMiddleware(async (req, context) => {
  requireScope(context.scopes, 'write');
  
  const url = new URL(req.url);
  const noteId = url.pathname.split('/').pop();
  
  if (!noteId) {
    return NextResponse.json(
      { error: 'Note ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const body = await req.json();
    const supabase = await getServerSupabase();
    
    // Verify note exists and belongs to user
    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', context.userId)
      .single();
    
    if (fetchError || !existingNote) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    // Build update object (only allow certain fields)
    const allowedFields = [
      'summary',
      'original_notes',
      'takeaways',
      'actions',
      'sentiment',
      'persona',
      'folder_id',
      'workspace_id',
      'is_public',
      'is_pinned',
    ];
    
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }
    
    // Update the note
    const { data, error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('user_id', context.userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating note:', error);
      return NextResponse.json(
        { error: 'Failed to update note', details: error.message },
        { status: 500 }
      );
    }
    
    // Handle tags update if provided
    if (body.tags && Array.isArray(body.tags)) {
      // Delete existing tags
      await supabase
        .from('note_tags')
        .delete()
        .eq('note_id', noteId);
      
      // Add new tags
      for (const tagName of body.tags) {
        let { data: tagData } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .eq('user_id', context.userId)
          .single();
        
        if (!tagData) {
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ name: tagName, user_id: context.userId })
            .select()
            .single();
          tagData = newTag;
        }
        
        if (tagData) {
          await supabase
            .from('note_tags')
            .insert({
              note_id: noteId,
              tag_id: tagData.id,
            });
        }
      }
    }
    
    return NextResponse.json({
      data,
      message: 'Note updated successfully',
    });
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/v1/notes/[id] - Delete a note
 */
export const DELETE = withApiMiddleware(async (req, context) => {
  requireScope(context.scopes, 'write');
  
  const url = new URL(req.url);
  const noteId = url.pathname.split('/').pop();
  
  if (!noteId) {
    return NextResponse.json(
      { error: 'Note ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const supabase = await getServerSupabase();
    
    // Verify note exists and belongs to user
    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', context.userId)
      .single();
    
    if (fetchError || !existingNote) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    // Delete the note (cascades will handle note_tags, etc.)
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', context.userId);
    
    if (error) {
      console.error('Error deleting note:', error);
      return NextResponse.json(
        { error: 'Failed to delete note', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting note:', error);
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
