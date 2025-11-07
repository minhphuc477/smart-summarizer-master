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
});
