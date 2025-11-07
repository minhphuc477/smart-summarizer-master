import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchBar from '../SearchBar';

// Helper to get the dialog content container
const getDialog = () => screen.getByRole('dialog');

describe('SearchBar - Advanced Filters & Saved Searches', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // fresh fetch mock per test
    (global.fetch as jest.Mock) = jest.fn();
  });

  test('opens filters dialog and applies sentiment/tag/restrict filters into search request', async () => {
    // First search call returns empty results
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    render(<SearchBar userId={mockUserId} />);

    // Type a query
    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'project roadmap' } });

    // Open filters
    const filtersBtn = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filtersBtn);

    // In dialog: set sentiment to Positive
  const dialog = getDialog();
  // Radix Select trigger is exposed as a combobox without an accessible name
  const sentimentTrigger = within(dialog).getByRole('combobox');
  fireEvent.click(sentimentTrigger);
    const positiveItem = await screen.findByRole('option', { name: /positive/i });
    fireEvent.click(positiveItem);

    // Add a tag and uncheck restrict-to-folder
    const tagInput = within(dialog).getByPlaceholderText('Type a tag and press Enter');
    fireEvent.change(tagInput, { target: { value: 'work' } });
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' });

    const restrictCheckbox = within(dialog).getByLabelText(/restrict to current folder/i);
    // Uncheck if checked
    if ((restrictCheckbox as HTMLInputElement).checked) {
      fireEvent.click(restrictCheckbox);
    }

    // Apply
    const applyBtn = within(dialog).getByRole('button', { name: /apply/i });
    fireEvent.click(applyBtn);

    // Submit search
    const searchBtn = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/search',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"query":"project roadmap"'),
        })
      );
    });

    // Inspect the actual body for filters and null folderId
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const parsed = JSON.parse(options.body);
    expect(parsed.userId).toBe(mockUserId);
    expect(parsed.folderId).toBeNull();
    // sentiment should be set to positive (not 'any'), tags array should include 'work'
    expect(parsed.filters).toMatchObject({ sentiment: 'positive', tags: ['work'] });
    // matchThreshold should respect current slider default (0.75)
    expect(parsed.matchThreshold).toBeCloseTo(0.75, 2);
  });

  test('saves current search and renders a saved search chip', async () => {
    // Mock the POST to /api/search/saved
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ item: { id: 1, name: 'my search', query: 'alpha', filters: { restrictToFolder: true } } }),
    });

    // Stub prompt to provide a name
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('my search');

    render(<SearchBar userId={mockUserId} />);

    // Type a query so Save is allowed
    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'alpha' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    // Wait for the chip to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /my search/i })).toBeInTheDocument();
    });

    promptSpy.mockRestore();
  });
});
