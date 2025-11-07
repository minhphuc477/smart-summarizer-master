import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchBar from '../SearchBar';

describe('SearchBar accessibility', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as any) = jest.fn();
  });

  test('announces error via role=alert', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Service down' }),
    });

    render(<SearchBar userId={mockUserId} />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'foo' } });
    fireEvent.submit(input.closest('form')!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Service down');
  });

  test('loading section exposes role=status and aria-busy', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => ({ results: [] }) }), 100))
    );

    render(<SearchBar userId={mockUserId} />);
    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'foo' } });
    fireEvent.submit(input.closest('form')!);

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });
});
