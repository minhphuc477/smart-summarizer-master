import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FolderSidebar from '../FolderSidebar';

const mockedFetch = global.fetch as unknown as jest.Mock;

describe('FolderSidebar', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  test('shows empty state when no folders', async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ folders: [] }) });

    render(
      <FolderSidebar userId="user-1" onFolderSelect={jest.fn()} selectedFolderId={null} />
    );

    expect(await screen.findByText(/No folders yet/i)).toBeInTheDocument();
  });

  test('clicking All Notes triggers onFolderSelect(null)', async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ folders: [] }) });

    const onFolderSelect = jest.fn();
    render(
      <FolderSidebar userId="user-1" onFolderSelect={onFolderSelect} selectedFolderId={123 as any} />
    );

    const allNotesBtn = await screen.findByRole('button', { name: /All Notes/i });
    fireEvent.click(allNotesBtn);

    expect(onFolderSelect).toHaveBeenCalledWith(null);
  });
});
