import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersionHistory } from '../VersionHistory';
import type { NoteVersion } from '@/lib/realtime/types';

describe('VersionHistory', () => {
  const mockVersions: NoteVersion[] = [
    {
      id: 3,
      note_id: 123,
      user_id: 'user-1',
      version_number: 3,
      summary: 'Latest summary',
      takeaways: ['Takeaway 1', 'Takeaway 2'],
      actions: [{ task: 'Do something', datetime: null }],
      tags: ['tag1', 'tag2'],
      sentiment: 'positive',
      created_at: '2025-11-01T12:00:00Z',
      user_email: 'user1@example.com',
      user_name: 'Alice',
    },
    {
      id: 2,
      note_id: 123,
      user_id: 'user-2',
      version_number: 2,
      summary: 'Previous summary',
      takeaways: ['Old takeaway'],
      actions: [],
      tags: ['tag1'],
      sentiment: 'neutral',
      created_at: '2025-11-01T11:00:00Z',
      user_email: 'user2@example.com',
      user_name: 'Bob',
    },
    {
      id: 1,
      note_id: 123,
      user_id: 'user-1',
      version_number: 1,
      summary: 'First version',
      takeaways: [],
      actions: [],
      tags: [],
      sentiment: null,
      created_at: '2025-11-01T10:00:00Z',
      user_email: 'user1@example.com',
      user_name: 'Alice',
    },
  ];

  const mockOnRestore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render version history timeline', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    expect(screen.getByText('Version 3')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
    expect(screen.getByText('Version 1')).toBeInTheDocument();
  });

  it('should display version metadata', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    // Check that version numbers and user info are displayed
    expect(screen.getByText('Version 3')).toBeInTheDocument();
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('should highlight current version', () => {
    const { container } = render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    const currentVersionElement = container.querySelector('[data-version="3"]');
    expect(currentVersionElement).toHaveClass('current');
  });

  it('should expand version to show details', async () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    // Initially, details should be hidden
    expect(screen.queryByText('Takeaway 1')).not.toBeInTheDocument();

    // Click to expand version 3
    const versionHeader = screen.getByText('Version 3');
    fireEvent.click(versionHeader);

    await waitFor(() => {
      expect(screen.getByText('Takeaway 1')).toBeInTheDocument();
      expect(screen.getByText('Takeaway 2')).toBeInTheDocument();
    });
  });

  it('should show diff between versions', async () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    // Expand a version to see details
    const version2 = screen.getByText('Version 2');
    fireEvent.click(version2);

    await waitFor(() => {
      // Should show version details
      expect(screen.getByText('Previous summary')).toBeInTheDocument();
    });
  });

  it('should allow restoring a previous version', async () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    // Find and click restore button for version 2
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    expect(restoreButtons.length).toBeGreaterThan(0);
    
    fireEvent.click(restoreButtons[0]);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    // Confirm restoration
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnRestore).toHaveBeenCalled();
    });
  });

  it('should not show restore button for current version', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    // Get all restore buttons
    const restoreButtons = screen.queryAllByRole('button', { name: /restore/i });
    
    // Should have restore buttons for non-current versions only (versions 2 and 1)
    expect(restoreButtons.length).toBe(2);
  });

  it('should display relative timestamps', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    // Should show relative times like "2 hours ago"
    expect(screen.getAllByText(/ago/i).length).toBeGreaterThan(0);
  });

  it('should show empty state when no versions', () => {
    render(
      <VersionHistory
        versions={[]}
        currentVersion={1}
        onRestore={mockOnRestore}
      />
    );

    expect(screen.getByText(/no version history/i)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
        loading
      />
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display version change statistics', async () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    const version3 = screen.getByText('Version 3');
    fireEvent.click(version3);

    await waitFor(() => {
      // Should show stats in the expanded view
      expect(screen.getByText(/2 takeaway/)).toBeInTheDocument();
    });
  });

  it('should handle version restore confirmation', async () => {
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersion={3}
        onRestore={mockOnRestore}
      />
    );

    // Click restore button
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    fireEvent.click(restoreButtons[1]); // Click on version 1's restore button

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnRestore).toHaveBeenCalled();
    });
  });
});
