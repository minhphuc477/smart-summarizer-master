export type SampleGuestNoteInput = {
  original_notes: string;
  persona: string | null;
  summary: string;
  takeaways: string[];
  actions: { task: string; datetime: string | null }[];
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
};

export function getSampleGuestNotes(): SampleGuestNoteInput[] {
  return [
    {
      original_notes: 'Team sync with Alice and Bob about Q4 roadmap. Discussed priorities and blockers. Action items assigned.',
      persona: 'Professional',
      summary: 'Q4 roadmap sync: clarified priorities and assigned action items',
      takeaways: [
        'Focus on performance improvements in November',
        'Defer minor UI tweaks to December',
      ],
      actions: [
        { task: 'Draft performance plan', datetime: null },
        { task: 'Review UI backlog', datetime: null },
      ],
      tags: ['work', 'roadmap', 'meeting'],
      sentiment: 'neutral',
    },
    {
      original_notes: 'Learned about React hooks and how useEffect dependencies work. Practiced with a small demo.',
      persona: 'Student',
      summary: 'React hooks study session recap',
      takeaways: [
        'useEffect runs after render by default',
        'Dependency arrays control re-runs',
      ],
      actions: [
        { task: 'Build a small hooks-based app', datetime: null },
      ],
      tags: ['learning', 'react', 'notes'],
      sentiment: 'positive',
    },
    {
      original_notes: 'Grocery list and quick weekly plan.',
      persona: null,
      summary: 'Weekly plan and groceries',
      takeaways: ['Plan meals ahead', 'Shop on Saturday morning'],
      actions: [
        { task: 'Buy groceries', datetime: null },
      ],
      tags: ['personal', 'planning'],
      sentiment: 'neutral',
    },
  ];
}
