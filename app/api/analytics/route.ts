import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET: Lấy analytics data
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30'; // days
    const days = parseInt(range);

    // Get analytics for last N days
    const { data: analytics, error } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching analytics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get summary - calculate directly from notes since RPC may have mismatched schema
    const { data: notesForSummary, error: summaryError } = await supabase
      .from('notes')
      .select('id, summary, original_notes, created_at')
      .eq('user_id', user.id);

    const summary = {
      total_notes: 0,
      total_summaries: 0,
      total_canvases: 0,
      total_templates_used: 0,
      total_words: 0,
      total_active_minutes: 0,
      active_days: 0,
      last_active_date: new Date(0).toISOString(),
    };

    if (!summaryError && notesForSummary) {
      summary.total_notes = notesForSummary.length;
      summary.total_summaries = notesForSummary.filter(n => n.summary).length;
      
      // Calculate total words from original_notes
      summary.total_words = notesForSummary.reduce((acc, note) => {
        const text = note.original_notes || note.summary || '';
        return acc + text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
      }, 0);

      // Get unique dates for active_days
      const uniqueDates = new Set(notesForSummary.map(n => n.created_at.split('T')[0]));
      summary.active_days = uniqueDates.size;

      // Get last active date
      if (notesForSummary.length > 0) {
        const sortedNotes = [...notesForSummary].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        summary.last_active_date = sortedNotes[0].created_at;
      }
    }

    // Calculate active minutes from usage_events if available, otherwise estimate
    const { data: usageEvents } = await supabase
      .from('usage_events')
      .select('created_at, event_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (usageEvents && usageEvents.length > 0) {
      // Calculate session-based active time
      let totalMinutes = 0;
      let sessionStart = new Date(usageEvents[0].created_at);
      
      for (let i = 1; i < usageEvents.length; i++) {
        const current = new Date(usageEvents[i].created_at);
        const diff = (current.getTime() - sessionStart.getTime()) / 1000 / 60; // minutes
        
        // If events are within 30 minutes, count as same session
        if (diff <= 30) {
          totalMinutes += diff;
        }
        sessionStart = current;
      }
      
      summary.total_active_minutes = Math.round(totalMinutes);
    } else {
      // Fallback: Estimate based on note count (2 minutes per note)
      summary.total_active_minutes = (summary.total_notes || 0) * 2;
    }

    // Get canvas count
    const { data: canvases } = await supabase
      .from('canvases')
      .select('id')
      .eq('user_id', user.id);
    
    if (canvases) {
      summary.total_canvases = canvases.length;
    }

    // Get recent events for display
    const { data: recentEvents } = await supabase
      .from('usage_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get tag distribution
    const { data: tagStats } = await supabase
      .from('note_tags')
      .select(`
        tag_id,
        tags (name)
      `)
      .limit(1000);

    // Count tags
    const tagCounts: Record<string, number> = {};
    const tagItems = (tagStats ?? []) as Array<{ tags?: { name?: string } | null }>;
    tagItems.forEach((item) => {
      const tagName = item.tags?.name;
      if (tagName) {
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      }
    });

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Get sentiment distribution
    type SentNote = { sentiment: 'positive' | 'neutral' | 'negative' | null; created_at: string };
    const { data: notes } = await supabase
      .from('notes')
      .select('sentiment, created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    // Calculate sentiment distribution
    const sentimentDistribution = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    // Calculate sentiment over time (group by date)
    const sentimentByDate: Record<string, { positive: number; neutral: number; negative: number }> = {};

    (notes as SentNote[] | null || []).forEach((note) => {
      const sentiment = (note.sentiment ?? 'neutral') as 'positive' | 'neutral' | 'negative';
      if (sentiment === 'positive') sentimentDistribution.positive++;
      else if (sentiment === 'negative') sentimentDistribution.negative++;
      else sentimentDistribution.neutral++;

      // Group by date
      const date = note.created_at.split('T')[0];
      if (!sentimentByDate[date]) {
        sentimentByDate[date] = { positive: 0, neutral: 0, negative: 0 };
      }
      if (sentiment === 'positive') sentimentByDate[date].positive++;
      else if (sentiment === 'negative') sentimentByDate[date].negative++;
      else sentimentByDate[date].neutral++;
    });

    const sentimentData = Object.entries(sentimentByDate)
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      analytics: analytics || [],
      summary: summary || {
        total_notes: 0,
        total_summaries: 0,
        total_canvases: 0,
        total_templates_used: 0,
        total_words: 0,
        total_active_minutes: 0,
        active_days: 0,
        last_active_date: new Date(0).toISOString(),
      },
      recentEvents,
      topTags,
      sentimentData,
      sentimentDistribution,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Track event
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_type, event_data } = body;

    if (!event_type) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
    }

    // Insert event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type,
      event_data: event_data || {},
    });

    // Update analytics
    await supabase.rpc('increment_user_analytics', {
      p_user_id: user.id,
      p_event_type: event_type,
      p_increment_value: 1,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
