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

  test('creates a new workspace and selects it', async () => {
    // initial list
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ workspaces: [] }) });

    const onChange = jest.fn();
    render(
      <WorkspaceManager selectedWorkspaceId={null} onWorkspaceChange={onChange} />
    );

    const newBtn = await screen.findByRole('button', { name: /New Workspace/i });
    fireEvent.click(newBtn);

    const nameInput = await screen.findByPlaceholderText(/e\.g\., Marketing Team/i);
    fireEvent.change(nameInput, { target: { value: 'Team Alpha' } });

  mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ workspace: { id: 'w1', name: 'Team Alpha', description: null, role: 'owner' } }) });

    const createBtn = screen.getByRole('button', { name: /^Create$/i });
    fireEvent.click(createBtn);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('w1'));
  });

  test('prevents duplicate workspace name client-side', async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ workspaces: [{ id: 'abc', name: 'Existing Space', description: null, role: 'owner', member_count: 1, note_count: 0, folder_count: 0 }] }) });
    const onChange = jest.fn();
    render(<WorkspaceManager selectedWorkspaceId={null} onWorkspaceChange={onChange} />);

    const newBtn = await screen.findByRole('button', { name: /New Workspace/i });
    fireEvent.click(newBtn);
    const nameInput = await screen.findByLabelText(/New workspace name/i);
    fireEvent.change(nameInput, { target: { value: 'Existing Space' } });

    const createBtn = screen.getByRole('button', { name: /^Create$/i });
    fireEvent.click(createBtn);

    // Should not call POST due to duplicate name client-side; fetch was called once for initial load only
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/You already have a workspace with this name/i)).toBeInTheDocument();
  });

  test('personal option is always present and selectable returning null', async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ workspaces: [{ id: 'p1', name: 'Personal (Private) – Team', description: null, role: 'member', member_count: 3, note_count: 0, folder_count: 0 }] }) });
    const onChange = jest.fn();
    // Set initial selection to workspace id so switching to personal triggers change
    render(<WorkspaceManager selectedWorkspaceId={'p1'} onWorkspaceChange={onChange} />);

    // Open the select dropdown
    const trigger = await screen.findByRole('combobox', { name: /Workspace selector/i });
    fireEvent.click(trigger);

  // Ensure the Personal (Private) static option exists and select it from the dropdown content
    const content = await waitFor(() => document.querySelector('[data-slot="select-content"]')) as Element;
    const items = Array.from(content.querySelectorAll('[data-slot="select-item"]')) as HTMLElement[];
    const personalItem = items.find(el => el.textContent?.includes('Personal (Private)')) as HTMLElement;
    expect(personalItem).toBeTruthy();
    fireEvent.click(personalItem);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });
});
