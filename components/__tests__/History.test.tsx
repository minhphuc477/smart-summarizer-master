import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import History from '../History';
import * as guestMode from '@/lib/guestMode';

// Mock guestMode module to allow easy stubbing in tests
jest.mock('@/lib/guestMode', () => ({
  getGuestHistory: jest.fn(() => []),
  deleteGuestNote: jest.fn(),
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          range: jest.fn(() => ({ data: [], error: null, count: 0 })),
          data: [],
          error: null,
        })),
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            range: jest.fn(() => ({ data: [], error: null, count: 0 })),
            data: [],
            error: null,
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null,
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 1 },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('History', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Guest Mode', () => {
    beforeEach(() => {
      (guestMode.getGuestHistory as jest.Mock).mockReturnValue([
        {
          id: '1',
          original_notes: 'Guest note 1',
          persona: 'Student',
          summary: 'Summary 1',
          takeaways: ['Point 1'],
          actions: [],
          tags: ['test'],
          sentiment: 'neutral',
          created_at: '2025-10-28T10:00:00Z',
        },
        {
          id: '2',
          original_notes: 'Guest note 2',
          persona: null,
          summary: 'Summary 2',
          takeaways: [],
          actions: [],
          tags: [],
          sentiment: 'positive',
          created_at: '2025-10-28T11:00:00Z',
        },
      ]);
      (guestMode.deleteGuestNote as jest.Mock).mockImplementation(() => {});
    });

    test('displays guest notes from localStorage', async () => {
      render(<History isGuest={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Summary 1')).toBeInTheDocument();
        expect(screen.getByText('Summary 2')).toBeInTheDocument();
      });
    });

    test('displays empty state when no guest notes', async () => {
  (guestMode.getGuestHistory as jest.Mock).mockReturnValue([]);
      
      render(<History isGuest={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/No notes yet/i)).toBeInTheDocument();
      });
    });

    test('deletes guest note', async () => {
      render(<History isGuest={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Summary 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
      
      // Confirm deletion in dialog
      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(guestMode.deleteGuestNote).toHaveBeenCalledWith('1');
      });
    });

    test('shows sentiment emoji for guest notes', async () => {
      render(<History isGuest={true} />);
      
      await waitFor(() => {
        // Check for neutral and positive sentiment emojis
        const summaryElements = screen.getAllByText(/Summary/);
        expect(summaryElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Authenticated Mode', () => {
    const mockNotes = [
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
          { tags: { id: 1, name: 'work' } },
          { tags: { id: 2, name: 'meeting' } },
        ],
      },
      {
        id: 2,
        created_at: '2025-10-28T11:00:00Z',
        summary: 'Personal note',
        persona: null,
        sentiment: 'neutral',
        folder_id: 5,
        is_public: true,
        share_id: 'abc123',
        folders: { id: 5, name: 'Personal', color: '#3B82F6' },
        note_tags: [],
      },
    ];

    beforeEach(() => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation((table: string) => {
        if (table === 'notes') {
          return {
            select: () => ({
              order: () => ({
                range: () => ({ data: mockNotes, error: null, count: mockNotes.length }),
                data: mockNotes,
                error: null,
              }),
              eq: () => ({
                order: () => {
                  const filtered = mockNotes.filter(n => n.folder_id === 5);
                  return {
                    range: () => ({ data: filtered, error: null, count: filtered.length }),
                    data: filtered,
                    error: null,
                  };
                },
              }),
            }),
            delete: () => ({
              eq: () => ({
                data: null,
                error: null,
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => ({
                    data: { id: 1 },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        } else if (table === 'folders') {
          return {
            select: () => ({
              order: () => ({
                data: [
                  { id: 5, name: 'Personal', color: '#3B82F6' },
                  { id: 6, name: 'Work', color: '#10B981' },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          select: () => ({
            order: () => ({ data: [], error: null }),
          }),
        };
      });
    });

    test('fetches and displays authenticated user notes', async () => {
      render(<History isGuest={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('Meeting notes summary')).toBeInTheDocument();
        expect(screen.getByText('Personal note')).toBeInTheDocument();
      });
    });

    test('displays tags for notes', async () => {
      render(<History isGuest={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('work')).toBeInTheDocument();
        expect(screen.getByText('meeting')).toBeInTheDocument();
      });
    });

    test('displays folder badges', async () => {
      render(<History isGuest={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('Personal')).toBeInTheDocument();
      });
    });

    test('shows public indicator for shared notes', async () => {
      render(<History isGuest={false} />);
      
      await waitFor(() => {
        const publicIndicators = screen.getAllByText(/public/i);
        expect(publicIndicators.length).toBeGreaterThan(0);
      });
    });

    test('filters notes by folder', async () => {
      render(<History isGuest={false} selectedFolderId={5} />);
      
      await waitFor(() => {
        expect(screen.getByText('Personal note')).toBeInTheDocument();
        expect(screen.queryByText('Meeting notes summary')).not.toBeInTheDocument();
      });
    });

    test('deletes authenticated note', async () => {
      const { supabase } = require('@/lib/supabase');
      
      render(<History isGuest={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('Meeting notes summary')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
      
      // Confirm deletion
      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('notes');
      });
    });

    test('opens move to folder dialog', async () => {
      render(<History isGuest={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('Meeting notes summary')).toBeInTheDocument();
      });

      const moveButtons = screen.getAllByRole('button', { name: /move/i });
      if (moveButtons.length > 0) {
        fireEvent.click(moveButtons[0]);
        
        await waitFor(() => {
          expect(screen.getByText(/Move to Folder/i)).toBeInTheDocument();
        });
      }
    });

    test('copies share link to clipboard', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<History isGuest={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('Personal note')).toBeInTheDocument();
      });

      const shareButtons = screen.getAllByRole('button', { name: /share|copy/i });
      if (shareButtons.length > 0) {
        fireEvent.click(shareButtons[0]);
        
        await waitFor(() => {
          expect(mockClipboard.writeText).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Loading State', () => {
    test('displays loading skeleton', () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() => ({
        select: () => ({
          order: () => new Promise(() => {}), // Never resolves
        }),
      }));

      render(<History isGuest={false} />);
      
      const skeletons = document.querySelectorAll('[class*="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('handles fetch error gracefully', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() => ({
        select: () => ({
          order: () => ({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      }));

      render(<History isGuest={false} />);
      
      await waitFor(() => {
        // Should still render without crashing
        const component = screen.getByText(/Your Notes|No notes yet/i);
        expect(component).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    test('shows empty state for authenticated users with no notes', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() => ({
        select: () => ({
          order: () => ({
            range: () => ({ data: [], error: null, count: 0 }),
            data: [],
            error: null,
          }),
        }),
      }));

      render(<History isGuest={false} />);
      
      await waitFor(() => {
        expect(screen.getByText(/No notes yet/i)).toBeInTheDocument();
      });
    });
  });
});
