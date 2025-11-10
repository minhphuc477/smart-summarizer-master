import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CanvasVersionHistory from '@/components/versions/CanvasVersionHistory';

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

describe('CanvasVersionHistory', () => {
  const canvasId = 'c-123';
  const originalFetch = global.fetch as unknown as jest.Mock;

  beforeEach(() => {
    (global.fetch as unknown as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    (global.fetch as unknown as jest.Mock) = originalFetch;
    jest.resetAllMocks();
  });

  it('renders versions from API', async () => {
    (global.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          versions: [
            { id: 1, version_number: 3, created_at: new Date().toISOString(), snapshot_type: 'auto' },
            { id: 2, version_number: 2, created_at: new Date().toISOString(), snapshot_type: 'manual' },
          ],
        }),
      });

    render(<CanvasVersionHistory canvasId={canvasId} />);

    expect(await screen.findByText(/Canvas Versions/i)).toBeInTheDocument();
    expect(await screen.findByText(/Version 3/i)).toBeInTheDocument();
    expect(await screen.findByText(/Version 2/i)).toBeInTheDocument();
  });

  it('creates manual snapshot and reloads', async () => {
    (global.fetch as unknown as jest.Mock)
      // initial load
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versions: [] }),
      })
      // POST create snapshot
      .mockResolvedValueOnce({ ok: true })
      // reload list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versions: [{ id: 10, version_number: 1, created_at: new Date().toISOString() }] }),
      });

    render(<CanvasVersionHistory canvasId={canvasId} />);

    // wait initial
    await screen.findByText(/Canvas Versions/i);

    const saveBtn = screen.getByRole('button', { name: /Save Snapshot/i });
    await userEvent.click(saveBtn);

    await waitFor(() => expect(screen.getByText(/Version 1/i)).toBeInTheDocument());

    expect((global.fetch as unknown as jest.Mock)).toHaveBeenNthCalledWith(2, `/api/canvases/${canvasId}/versions`, { method: 'POST' });
  });

  it('restores a version', async () => {
    (global.fetch as unknown as jest.Mock)
      // initial list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versions: [{ id: 5, version_number: 2, created_at: new Date().toISOString() }] }),
      })
      // restore call
      .mockResolvedValueOnce({ ok: true });

    const onRestore = jest.fn();
    render(<CanvasVersionHistory canvasId={canvasId} onRestore={onRestore} />);

    const row = await screen.findByText(/Version 2/i);
    const rowEl = row.closest('li')!;
    const restoreBtn = within(rowEl).getByRole('button', { name: /Restore/i });
    await userEvent.click(restoreBtn);

    await flushPromises();
    expect((global.fetch as unknown as jest.Mock)).toHaveBeenLastCalledWith(
      `/api/canvases/${canvasId}/versions/5/restore`,
      { method: 'POST' }
    );
    expect(onRestore).toHaveBeenCalled();
  });
});
