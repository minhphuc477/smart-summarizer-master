import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceManager from '../WorkspaceManager';

const mockedFetch = global.fetch as unknown as jest.Mock;

describe('WorkspaceManager', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  test('renders and loads workspaces', async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ workspaces: [] }) });

    render(
      <WorkspaceManager selectedWorkspaceId={null} onWorkspaceChange={jest.fn()} />
    );

    expect(await screen.findByText(/Workspace/i)).toBeInTheDocument();
  });

  test('creates a new workspace', async () => {
    // initial list
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ workspaces: [] }) });

    render(
      <WorkspaceManager selectedWorkspaceId={null} onWorkspaceChange={jest.fn()} />
    );

    const newBtn = await screen.findByRole('button', { name: /New Workspace/i });
    fireEvent.click(newBtn);

    const nameInput = await screen.findByPlaceholderText(/e\.g\., Marketing Team/i);
    fireEvent.change(nameInput, { target: { value: 'Team Alpha' } });

    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ workspace: { id: 'w1', name: 'Team Alpha', description: null, role: 'owner' } }) });

    const createBtn = screen.getByRole('button', { name: /^Create$/i });
    fireEvent.click(createBtn);

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
  });
});
