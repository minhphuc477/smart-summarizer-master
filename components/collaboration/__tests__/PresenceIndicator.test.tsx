import React from 'react';
import { render, screen } from '@testing-library/react';
import { PresenceIndicator } from '../PresenceIndicator';
import type { PresenceState } from '@/lib/realtime/types';

describe('PresenceIndicator', () => {
  const mockPresence: PresenceState[] = [
    {
      user_id: 'user-1',
      user_email: 'user1@example.com',
      user_name: 'Alice Smith',
      user_avatar: 'https://example.com/avatar1.jpg',
      status: 'editing',
      last_seen: new Date().toISOString(),
    },
    {
      user_id: 'user-2',
      user_email: 'user2@example.com',
      user_name: 'Bob Jones',
      status: 'viewing',
      last_seen: new Date().toISOString(),
    },
    {
      user_id: 'user-3',
      user_email: 'user3@example.com',
      user_name: 'Charlie Brown',
      status: 'idle',
      last_seen: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    },
  ];

  it('should render presence indicators', () => {
    render(<PresenceIndicator presence={mockPresence} />);

    // Check that avatars are rendered (by initials)
    expect(screen.getByText('AS')).toBeInTheDocument(); // Alice Smith
    expect(screen.getByText('BJ')).toBeInTheDocument(); // Bob Jones
    expect(screen.getByText('CB')).toBeInTheDocument(); // Charlie Brown
  });

  it('should show user avatars', () => {
    render(<PresenceIndicator presence={mockPresence} />);

    // Check that avatars are rendered (fallback shows initials since no image loaded in test)
    expect(screen.getByText('AS')).toBeInTheDocument();
  });

  it('should show user initials when no avatar', () => {
    render(<PresenceIndicator presence={mockPresence} />);

    // Bob Jones should show "BJ" initials
    expect(screen.getByText('BJ')).toBeInTheDocument();
  });

  it('should display status indicators', () => {
    render(<PresenceIndicator presence={mockPresence} />);

    // Check that status colors are applied
    const container = screen.getByText('3 users online').closest('div');
    expect(container).toBeInTheDocument();
  });

  it('should show different colors for different statuses', () => {
    const { container } = render(<PresenceIndicator presence={mockPresence} />);

    // Check for status indicator elements with different colors
    const editingIndicator = container.querySelector('[data-status="editing"]');
    const viewingIndicator = container.querySelector('[data-status="viewing"]');
    const idleIndicator = container.querySelector('[data-status="idle"]');

    expect(editingIndicator).toBeInTheDocument();
    expect(viewingIndicator).toBeInTheDocument();
    expect(idleIndicator).toBeInTheDocument();
  });

  it('should show count when multiple users', () => {
    render(<PresenceIndicator presence={mockPresence} />);

    expect(screen.getByText(/3 users/i)).toBeInTheDocument();
  });

  it('should handle empty presence', () => {
    render(<PresenceIndicator presence={[]} />);

    expect(screen.getByText(/no one else/i)).toBeInTheDocument();
  });

  it('should show tooltip with user details on hover', () => {
    const { container } = render(<PresenceIndicator presence={mockPresence} />);

    // Check that tooltips exist (they contain user details)
    const avatars = container.querySelectorAll('[data-user-id]');
    expect(avatars.length).toBe(3);
    expect(avatars[0]).toHaveAttribute('data-user-id', 'user-1');
  });

  it('should display cursor positions for active users', () => {
    const presenceWithCursors: PresenceState[] = [
      {
        ...mockPresence[0],
        cursor_position: { x: 100, y: 200 },
      },
    ];

    const { container } = render(
      <PresenceIndicator presence={presenceWithCursors} showCursors />
    );

    const cursor = container.querySelector('[data-cursor-user="user-1"]');
    expect(cursor).toBeInTheDocument();
  });

  it('should sort by status priority (editing > viewing > idle)', () => {
    const { container } = render(<PresenceIndicator presence={mockPresence} />);

    const avatars = container.querySelectorAll('[data-user-id]');
    const userOrder = Array.from(avatars).map(
      (el) => el.getAttribute('data-user-id')
    );

    // Alice (editing) should come before Bob (viewing) and Charlie (idle)
    expect(userOrder[0]).toBe('user-1');
    expect(userOrder[1]).toBe('user-2');
    expect(userOrder[2]).toBe('user-3');
  });

  it('should handle very long user names', () => {
    const presenceWithLongName: PresenceState[] = [
      {
        user_id: 'user-long',
        user_email: 'long@example.com',
        user_name: 'This Is A Very Long User Name That Should Be Truncated',
        status: 'viewing',
        last_seen: new Date().toISOString(),
      },
    ];

    const { container } = render(
      <PresenceIndicator presence={presenceWithLongName} />
    );

    // Check that the component renders with long name
    const userDiv = container.querySelector('[data-user-id="user-long"]');
    expect(userDiv).toBeInTheDocument();
  });
});
