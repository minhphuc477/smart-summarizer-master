import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import History from '../History';

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'notes') {
        return {
          select: () => ({
            order: () => ({
              range: () => ({
                data: [
                  {
                    id: 1,
                    created_at: '2025-10-28T10:00:00Z',
                    summary: 'Meeting notes summary',
                    persona: 'Professional',
                    sentiment: 'positive',
                    folder_id: null,
                    is_public: false,
                    share_id: null,
                    folders: null,
                    note_tags: [
                      { tags: { id: 2, name: 'meeting' } },
                    ],
                  },
                ],
                error: null,
                count: 1,
              }),
              data: [
                {
                  id: 1,
                  created_at: '2025-10-28T10:00:00Z',
                  summary: 'Meeting notes summary',
                  persona: 'Professional',
                  sentiment: 'positive',
                  folder_id: null,
                  is_public: false,
                  share_id: null,
                  folders: null,
                  note_tags: [
                    { tags: { id: 2, name: 'meeting' } },
                  ],
                },
              ],
              error: null,
            }),
          }),
          // For refreshOneNote path (defensive)
          eq: () => ({
            select: () => ({
              single: () => ({ data: { id: 1 }, error: null })
            })
          }),
        };
      }
      if (table === 'folders') {
        return {
          select: () => ({ order: () => ({ data: [], error: null }) }),
        };
      }
      return { select: () => ({ order: () => ({ data: [], error: null }) }) };
    }),
  },
}));

// Simple fetch mock to return suggested tags
const originalFetch = global.fetch;

beforeEach(() => {
  (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (url.includes('/api/notes/1/suggested-tags')) {
      return Promise.resolve(new Response(JSON.stringify({
        suggestions: [
          { name: 'work', score: 3 },
          { name: 'notes', score: 2 },
        ],
        count: 2,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    // Default 200 OK for unrelated fetches
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  }) as unknown as typeof fetch;
});

afterEach(() => {
  (global as any).fetch = originalFetch;
  jest.resetAllMocks();
});

describe('History - Suggested Tags', () => {
  test('renders suggested tags in tag dialog', async () => {
    render(<History isGuest={false} />);

    // Wait notes to appear
    await waitFor(() => {
      expect(screen.getByText('Meeting notes summary')).toBeInTheDocument();
    });

    // Open Manage tags dialog
    const manageButtons = screen.getAllByRole('button', { name: /manage tags/i });
    fireEvent.click(manageButtons[0]);

    // Suggested Tags section should load
    await waitFor(() => {
      expect(screen.getByText('Suggested Tags')).toBeInTheDocument();
    });
  });
});
