import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    test('renders search input and button', () => {
      render(<SearchBar userId={mockUserId} />);
      
      expect(screen.getByPlaceholderText('searchPlaceholder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });

    test('displays semantic search heading', () => {
      render(<SearchBar userId={mockUserId} />);
      
      expect(screen.getByText('semanticSearch')).toBeInTheDocument();
    });

    test('displays helpful description', () => {
      render(<SearchBar userId={mockUserId} />);
      
      expect(screen.getByText('semanticSearchDescription')).toBeInTheDocument();
    });

    test('search button is disabled when input is empty', () => {
      render(<SearchBar userId={mockUserId} />);
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toBeDisabled();
    });
  });

  describe('Search Input', () => {
    test('allows typing in search input', () => {
      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'meeting notes' } });
      
      expect(input.value).toBe('meeting notes');
    });

    test('enables search button when input has text', () => {
      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test query' } });
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).not.toBeDisabled();
    });

    test('shows clear button when input has text', () => {
      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    test('clears input when clear button is clicked', () => {
      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'test query' } });
      expect(input.value).toBe('test query');
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);
      
      expect(input.value).toBe('');
    });
  });

  describe('Search Execution', () => {
    test('performs search on button click', async () => {
      const mockResults = [
        {
          id: 1,
          summary: 'Meeting summary',
          original_notes: 'Meeting notes content',
          persona: 'Professional',
          created_at: '2025-10-28T10:00:00Z',
          similarity: 0.92,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'meeting' } });
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/search',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"query":"meeting"'),
          })
        );
      });
    });

    test('performs search on form submit', async () => {
      const mockResults: any[] = [];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      
      const form = input.closest('form')!;
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    test('includes userId in search request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/search',
          expect.objectContaining({
            body: expect.stringContaining(`"userId":"${mockUserId}"`),
          })
        );
      });
    });

    test('does not search with empty query', () => {
      render(<SearchBar userId={mockUserId} />);
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
      
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Search Results Display', () => {
    test('displays search results', async () => {
      const mockResults = [
        {
          id: 1,
          summary: 'First result summary',
          original_notes: 'Original content 1',
          persona: 'Student',
          created_at: '2025-10-28T10:00:00Z',
          similarity: 0.95,
        },
        {
          id: 2,
          summary: 'Second result summary',
          original_notes: 'Original content 2',
          persona: null,
          created_at: '2025-10-28T11:00:00Z',
          similarity: 0.87,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText('First result summary')).toBeInTheDocument();
        expect(screen.getByText('Second result summary')).toBeInTheDocument();
      });
    });

    test('displays similarity scores', async () => {
      const mockResults = [
        {
          id: 1,
          summary: 'Test result',
          original_notes: 'Content',
          persona: null,
          created_at: '2025-10-28T10:00:00Z',
          similarity: 0.92,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText('92% match')).toBeInTheDocument();
      });
    });

    test('displays result count', async () => {
      const mockResults = [
        {
          id: 1,
          summary: 'Result 1',
          original_notes: 'Content 1',
          persona: null,
          created_at: '2025-10-28T10:00:00Z',
          similarity: 0.9,
        },
        {
          id: 2,
          summary: 'Result 2',
          original_notes: 'Content 2',
          persona: null,
          created_at: '2025-10-28T11:00:00Z',
          similarity: 0.85,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText(/Found 2 relevant notes/i)).toBeInTheDocument();
      });
    });

    test('displays persona in results when present', async () => {
      const mockResults = [
        {
          id: 1,
          summary: 'Test',
          original_notes: 'Content',
          persona: 'Professional',
          created_at: '2025-10-28T10:00:00Z',
          similarity: 0.9,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText(/Persona: Professional/i)).toBeInTheDocument();
      });
    });
  });

  describe('Empty Results', () => {
    test('displays no results message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'nonexistent query' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText(/No results found/i)).toBeInTheDocument();
        expect(screen.getByText(/Try a different search query/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    test('displays loading state during search', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => ({ results: [] }) }), 100))
      );

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText(/searching/i)).toBeInTheDocument();
      });

      const skeletons = document.querySelectorAll('[class*="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    test('disables search button during search', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => ({ results: [] }) }), 100))
      );

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
      
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /searching/i });
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Search service unavailable' }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText(/Search service unavailable/i)).toBeInTheDocument();
      });
    });

    test('displays generic error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to search/i)).toBeInTheDocument();
      });
    });

    test('clears previous results on error', async () => {
      // First successful search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 1,
              summary: 'Previous result',
              original_notes: 'Content',
              persona: null,
              created_at: '2025-10-28T10:00:00Z',
              similarity: 0.9,
            },
          ],
        }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test1' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText('Previous result')).toBeInTheDocument();
      });

      // Second search fails
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      });

      fireEvent.change(input, { target: { value: 'test2' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.queryByText('Previous result')).not.toBeInTheDocument();
      });
    });
  });

  describe('Clear Functionality', () => {
    test('clears search results when clear button is clicked', async () => {
      const mockResults = [
        {
          id: 1,
          summary: 'Test result',
          original_notes: 'Content',
          persona: null,
          created_at: '2025-10-28T10:00:00Z',
          similarity: 0.9,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      });

      render(<SearchBar userId={mockUserId} />);
      
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText('Test result')).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);
      
      expect(screen.queryByText('Test result')).not.toBeInTheDocument();
    });
  });

  describe('Retry Logic with Lexical Fallback', () => {
    test('should automatically retry with lexical-only when SEMANTIC_RPC_FAILED is returned', async () => {
      // First call fails with SEMANTIC_RPC_FAILED
      // Second call (lexical-only retry) succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            error: 'Failed to search notes. Ensure semantic-search migration SQL ran.',
            code: 'SEMANTIC_RPC_FAILED',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                id: 1,
                summary: 'Test note from lexical',
                original_notes: 'This is a test',
                persona: 'default',
                created_at: '2025-01-01T00:00:00Z',
                similarity: 0,
              },
            ],
            query: 'test',
            count: 1,
            mode: 'lexical',
          }),
        });

      render(<SearchBar userId={mockUserId} />);

      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.submit(input.closest('form')!);

      // Wait for both fetch calls
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Verify first call was semantic (no lexicalOnly flag)
      const firstCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(firstCallBody.query).toBe('test query');
      expect(firstCallBody.lexicalOnly).toBeUndefined();

      // Verify second call was lexical-only retry
      const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      expect(secondCallBody.lexicalOnly).toBe(true);

      // Verify results are displayed
      await waitFor(() => {
        expect(screen.getByText('Test note from lexical')).toBeInTheDocument();
      });
    });

    test('should retry with lexical-only on SEMANTIC_DIMENSION_MISMATCH', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            error: 'Semantic search failed due to dimension mismatch. Expected 384.',
            code: 'SEMANTIC_DIMENSION_MISMATCH',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [],
            query: 'dimension test',
            count: 0,
            mode: 'lexical',
          }),
        });

      render(<SearchBar userId={mockUserId} />);

      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'dimension test' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Verify retry occurred with lexicalOnly flag
      const retryCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      expect(retryCallBody.lexicalOnly).toBe(true);
    });

    test('should not filter lexical results by similarity threshold', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 1,
              summary: 'Lexical match 1',
              original_notes: 'Content 1',
              persona: 'default',
              created_at: '2025-01-01T00:00:00Z',
              similarity: 0, // Lexical results have 0 similarity
            },
            {
              id: 2,
              summary: 'Lexical match 2',
              original_notes: 'Content 2',
              persona: 'default',
              created_at: '2025-01-02T00:00:00Z',
              similarity: 0,
            },
          ],
          query: 'keyword',
          count: 2,
          mode: 'lexical',
        }),
      });

      render(<SearchBar userId={mockUserId} />);

      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'keyword' } });
      fireEvent.submit(input.closest('form')!);

      // Both results should be displayed even though similarity is 0
      await waitFor(() => {
        expect(screen.getByText('Lexical match 1')).toBeInTheDocument();
        expect(screen.getByText('Lexical match 2')).toBeInTheDocument();
      });
    });

    test('should show error if both semantic and lexical-only retry fail', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            error: 'RPC failed',
            code: 'SEMANTIC_RPC_FAILED',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            error: 'Lexical search also failed',
            code: 'LEXICAL_FAILED',
          }),
        });

      render(<SearchBar userId={mockUserId} />);

      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'fail test' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Error should be displayed (original semantic error message)
      await waitFor(() => {
        expect(screen.getByText(/RPC failed/i)).toBeInTheDocument();
      });
    });

    test('should apply similarity filter for semantic results only', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 1,
              summary: 'High similarity',
              original_notes: 'Very relevant',
              persona: 'default',
              created_at: '2025-01-01T00:00:00Z',
              similarity: 0.85,
            },
            {
              id: 2,
              summary: 'Low similarity',
              original_notes: 'Less relevant',
              persona: 'default',
              created_at: '2025-01-02T00:00:00Z',
              similarity: 0.60,
            },
          ],
          query: 'semantic',
          count: 2,
          mode: 'semantic',
        }),
      });

      render(<SearchBar userId={mockUserId} />);

      // Default threshold is 0.75 (75%)
      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'semantic' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('High similarity')).toBeInTheDocument();
      });

      // Low similarity result should be filtered out on client side
      expect(screen.queryByText('Low similarity')).not.toBeInTheDocument();
    });
  });
});
