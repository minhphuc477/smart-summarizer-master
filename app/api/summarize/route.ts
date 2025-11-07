import { NextResponse } from 'next/server';
import { getGroqSummary } from '@/lib/groq'; // Import hàm tái sử dụng
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';
import { respondError } from '@/lib/apiErrors';

// Simple in-memory rate limiting (non-distributed). For production scale, replace with Upstash/Redis.
// Tracks timestamps of requests per key (userId or IP) and enforces a sliding window.
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT = 15; // max summaries per window
const requestLog = new Map<string, number[]>();

function allowRequest(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const arr = requestLog.get(key) || [];
  // Drop old timestamps
  const fresh = arr.filter(ts => now - ts < RATE_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  fresh.push(now);
  requestLog.set(key, fresh);
  return { allowed: true, remaining: RATE_LIMIT - fresh.length };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  
  logger.info('Starting summarization request');

  try {
  const { notes, customPersona, userId, folderId, workspaceId, isGuest } = await req.json();
    
    logger.debug('Request payload received', { 
      hasNotes: !!notes, 
      noteLength: notes?.length,
      customPersona, 
      userId, 
      folderId, 
      workspaceId,
      isGuest 
    });

    if (!notes || typeof notes !== 'string' || !notes.trim()) {
      logger.warn('Missing required field: notes');
      const { body, status } = respondError('INVALID_INPUT', 'Notes content is required.', 400);
      return NextResponse.json(body, { status });
    }

    // Input hard length guard (coarse) before model-specific handling in groq.ts.
    const MAX_LENGTH = 24_000; // Align with Groq truncation heuristic
    let safeNotes = notes;
    if (safeNotes.length > MAX_LENGTH) {
      logger.warn('Notes input exceeded MAX_LENGTH; truncating', undefined, { originalLength: safeNotes.length });
      safeNotes = safeNotes.slice(0, MAX_LENGTH);
    }

    // Rate limit (skip for guests to avoid blocking onboarding but still guard extreme abuse)
    const rateKey = userId ? `u:${userId}` : `ip:${req.headers.get('x-forwarded-for') || 'unknown'}`;
    const { allowed, remaining } = allowRequest(rateKey);
    if (!allowed && !isGuest) {
      const { body, status } = respondError('RATE_LIMIT', 'Too many summarization requests. Please wait a minute.', 429);
      logger.warn('Rate limit exceeded', undefined, { rateKey });
      return NextResponse.json({ ...body, retry_after_ms: RATE_WINDOW_MS, remaining }, { status });
    }

    // Call Groq API for summarization
  // Defensive trimming before Groq (groq.ts also safeguards)
  const aiStartTime = Date.now();
  const jsonResponse = await getGroqSummary(safeNotes, customPersona);
    const aiDuration = Date.now() - aiStartTime;
    
    logger.info('AI summarization completed', undefined, { 
      aiDuration, 
      tagsCount: jsonResponse.tags?.length || 0,
      sentiment: jsonResponse.sentiment 
    });
    
    // Guest mode: chỉ trả về kết quả, không lưu DB
    if (isGuest) {
      logger.info('Guest mode - skipping database save');
      const totalDuration = Date.now() - startTime;
      logger.logResponse('POST', '/api/summarize', 200, totalDuration, { isGuest: true });
      return NextResponse.json(jsonResponse);
    }
    
    // Logged in mode: Lưu vào database
    if (userId && jsonResponse.tags && Array.isArray(jsonResponse.tags)) {
      const dbStartTime = Date.now();
  const supabase = await getServerSupabase();
      
      try {
        // Bước 1: Lưu note vào bảng notes
        logger.debug('Saving note to database', { userId, folderId, workspaceId });
        
        const { data: noteData, error: noteError } = await supabase
          .from('notes')
          .insert({
            user_id: userId,
            persona: customPersona,
            original_notes: safeNotes,
            summary: jsonResponse.summary,
            takeaways: jsonResponse.takeaways,
            actions: jsonResponse.actions,
            sentiment: jsonResponse.sentiment || 'neutral',
            folder_id: folderId || null,
            workspace_id: workspaceId || null
          })
          .select()
          .single();

        if (noteError) throw noteError;

        const noteId = noteData.id;
        logger.info('Note saved successfully', { noteId });

        // Bước 2: Xử lý tags
        const tagNames = jsonResponse.tags;
        logger.debug('Processing tags', { tagCount: tagNames.length });

        for (const tagName of tagNames) {
          // Kiểm tra xem tag đã tồn tại chưa
          const { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('name', tagName)
            .eq('user_id', userId)
            .single();

          let tagId: number;

          if (existingTag) {
            // Tag đã tồn tại, dùng ID hiện có
            tagId = existingTag.id;
            logger.debug('Using existing tag', { tagName, tagId });
          } else {
            // Tạo tag mới
            const { data: newTag, error: tagError } = await supabase
              .from('tags')
              .insert({ name: tagName, user_id: userId })
              .select()
              .single();

            if (tagError) throw tagError;
            tagId = newTag.id;
            logger.debug('Created new tag', { tagName, tagId });
          }

          // Bước 3: Tạo liên kết trong bảng note_tags
          await supabase
            .from('note_tags')
            .insert({ note_id: noteId, tag_id: tagId });
        }

        const dbDuration = Date.now() - dbStartTime;
        logger.info('Database operations completed', undefined, { dbDuration });

        // Bước 4: Tạo embedding cho semantic search (async, không block response)
        logger.debug('Triggering background embedding generation', { noteId });
        
        const cookieHeader = req.headers.get('cookie');
        fetch(`${req.url.replace('/api/summarize', '/api/generate-embedding')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { cookie: cookieHeader } : {}) },
          body: JSON.stringify({
            noteId: noteId,
            text: safeNotes
          })
        }).catch(err => {
          logger.error('Error generating embedding', err as Error, { noteId });
        });

          // Bước 5: Auto-categorize into smart folders (async, không block response)
          logger.debug('Triggering background auto-categorization', { noteId });
        
          fetch(`${req.url.replace('/api/summarize', `/api/notes/${noteId}/auto-categorize`)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { cookie: cookieHeader } : {}) }
          }).catch(err => {
            logger.error('Error auto-categorizing note', err as Error, { noteId });
          });

      } catch (dbError) {
        logger.error('Database operation failed', dbError as Error, { userId });
        // Vẫn trả về kết quả AI dù lưu database thất bại
      }
    }

    const totalDuration = Date.now() - startTime;
    logger.logResponse('POST', '/api/summarize', 200, totalDuration, { userId, isGuest: false });
    return NextResponse.json(jsonResponse);

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logger.error('Summarization request failed', error as Error);
    logger.logResponse('POST', '/api/summarize', 500, totalDuration);
    const { body, status } = respondError('INTERNAL', 'Failed to process the request.', 500);
    return NextResponse.json(body, { status });
  }
}