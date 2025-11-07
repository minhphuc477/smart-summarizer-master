import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET: Lấy danh sách templates
export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Helper: default seed set used when DB is empty or public access is restricted
    const defaults = [
      {
        name: 'Meeting Notes',
        description: 'Structure for professional meeting notes with decisions and action items.',
        category: 'meetings',
        icon: '📋',
        persona_prompt: 'You are a professional meeting assistant. Be concise, structured, and action-oriented.',
        structure: `Title: \nDate: \nAttendees: \n\nAgenda:\n- \n\nNotes:\n- \n\nDecisions:\n- \n\nAction Items:\n- [ ] Owner:  Due:  Task: `,
        is_system: true,
      },
      {
        name: 'Daily Standup',
        description: 'Scrum standup format: Yesterday, Today, Blockers.',
        category: 'development',
        icon: '🏃',
        persona_prompt: 'You are a scrum master. Keep updates short and focused on progress and blockers.',
        structure: `Yesterday:\n- \n\nToday:\n- \n\nBlockers:\n- `,
        is_system: true,
      },
      {
        name: 'Bug Report',
        description: 'Template for reporting software defects clearly and reproducibly.',
        category: 'development',
        icon: '🐞',
        persona_prompt: 'You are a QA engineer. Provide clear reproduction steps and expected vs actual behavior.',
        structure: `Title:\nEnvironment:\nVersion:\n\nSteps to Reproduce:\n1) \n2) \n3) \n\nExpected Result:\n\nActual Result:\n\nSeverity: \nPriority: `,
        is_system: true,
      },
      {
        name: 'Project Plan',
        description: 'High-level project plan with scope, milestones, and risks.',
        category: 'planning',
        icon: '🗺️',
        persona_prompt: 'You are a project manager. Provide clear scope, timeline, and risk tracking.',
        structure: `Goal:\nScope:\nTimeline:\nMilestones:\n- \nRisks & Mitigations:\n- Risk:  Impact:  Mitigation: `,
        is_system: true,
      },
      {
        name: 'Research Summary',
        description: 'Summarize research with key findings and open questions.',
        category: 'education',
        icon: '🔬',
        persona_prompt: 'You are an academic summarizer. Be objective, cite sources, and list open questions.',
        structure: `Topic:\nSources:\n- \nKey Findings:\n- \nOpen Questions:\n- `,
        is_system: true,
      },
      {
        name: 'Lecture Notes',
        description: 'Structured notes for classes/lectures with examples and takeaways.',
        category: 'education',
        icon: '🎓',
        persona_prompt: 'You are a helpful teacher. Capture main points and practical examples.',
        structure: `Topic:\nMain Points:\n- \nExamples:\n- \nTakeaways:\n- \nHomework:\n- `,
        is_system: true,
      },
      {
        name: 'Brainstorming',
        description: 'Divergent ideas with pros/cons and next steps.',
        category: 'planning',
        icon: '💡',
        persona_prompt: 'You are a creative facilitator. Encourage diverse ideas and evaluate trade-offs.',
        structure: `Problem:\nIdeas:\n- \nPros / Cons:\n- \nNext Steps:\n- `,
        is_system: true,
      },
      {
        name: 'Interview Notes',
        description: 'Candidate evaluation: strengths, weaknesses, notes, and decision.',
        category: 'meetings',
        icon: '🧑‍💼',
        persona_prompt: 'You are a recruiter. Be fair, competency-based, and concise.',
        structure: `Candidate:\nRole:\nStrengths:\n- \nWeaknesses:\n- \nNotes:\n- \nDecision:\n- `,
        is_system: true,
      },
      {
        name: 'Code Review',
        description: 'Structured code review: summary, issues, suggestions, and TODOs.',
        category: 'development',
        icon: '🧪',
        persona_prompt: 'You are a senior engineer. Be constructive, specific, and prioritize impact.',
        structure: `Summary:\nStrengths:\n- \nIssues:\n- \nSuggestions:\n- \nTODOs:\n- `,
        is_system: true,
      },
    ];

    // If there is no user, attempt to fetch only public system templates; if that fails, fall back to defaults.
    if (authError || !user) {
      const { data: publicTemplates, error: publicError } = await supabase
        .from('templates')
        .select('*')
        .eq('is_system', true)
        .order('usage_count', { ascending: false });

      if (publicError) {
        console.warn('Public system templates fetch failed, returning in-memory defaults:', String((publicError as { message?: string }).message || 'Error'));
        const synthetic = defaults.map((d, i) => ({
          id: `sys-${i + 1}`,
          created_at: new Date().toISOString(),
          content: undefined,
          usage_count: 0,
          user_id: null,
          ...d,
        }));
        return NextResponse.json({ templates: synthetic });
      }

      if (!publicTemplates || publicTemplates.length === 0) {
        const synthetic = defaults.map((d, i) => ({
          id: `sys-${i + 1}`,
          created_at: new Date().toISOString(),
          content: undefined,
          usage_count: 0,
          user_id: null,
          ...d,
        }));
        return NextResponse.json({ templates: synthetic });
      }

      return NextResponse.json({ templates: publicTemplates });
    }

    // Get system templates và user's custom templates
    const { data: templatesData, error } = await supabase
      .from('templates')
      .select('*')
      .or(`is_system.eq.true,user_id.eq.${user.id}`)
      .order('is_system', { ascending: false })
      .order('usage_count', { ascending: false });
    let templates = templatesData;

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: String((error as { message?: string }).message || 'Error') }, { status: 500 });
    }

    // If no templates found, seed with sensible defaults (one-time bootstrap)
    if (!templates || templates.length === 0) {
      try {
        const { data: inserted, error: seedError } = await supabase
          .from('templates')
          .insert(
            defaults.map(d => ({
              ...d,
              usage_count: 0,
              user_id: null,
            }))
          )
          .select('*');

        if (seedError) {
          console.warn('Seeding templates failed, falling back to in-memory defaults:', String((seedError as { message?: string }).message || 'Error'));
          // Fallback: return in-memory defaults with synthetic IDs
          const synthetic = defaults.map((d, i) => ({
            id: `sys-${i + 1}`,
            created_at: new Date().toISOString(),
            content: undefined,
            ...d,
          }));
          return NextResponse.json({ templates: synthetic });
        }

        // After seeding, set templates to inserted rows
        templates = inserted || [];
      } catch (e) {
        console.warn('Unexpected error while seeding templates, returning in-memory defaults:', e);
        const synthetic = defaults.map((d, i) => ({
          id: `sys-${i + 1}`,
          created_at: new Date().toISOString(),
          content: undefined,
          ...d,
        }));
        return NextResponse.json({ templates: synthetic });
      }
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Tạo custom template
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, icon, persona_prompt, structure } = body;

    // Validation
    if (!name || !category || !structure) {
      return NextResponse.json(
        { error: 'Name, category, and structure are required' },
        { status: 400 }
      );
    }

    // Create template
    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        name,
        description,
        category,
        icon: icon || '📝',
        persona_prompt,
        structure,
        is_system: false,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json({ error: String((error as { message?: string }).message || 'Error') }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
