import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentThread } from '../CommentThread';
import type { Comment } from '@/lib/realtime/types';

describe('CommentThread', () => {
  const mockComments: Comment[] = [
    {
      id: 1,
      note_id: 123,
      user_id: 'user-1',
      content: 'This is a test comment',
      mentions: [],
      resolved: false,
      created_at: '2025-11-01T10:00:00Z',
      updated_at: '2025-11-01T10:00:00Z',
      user_email: 'test@example.com',
      user_name: 'Test User',
    },
    {
      id: 2,
      note_id: 123,
      user_id: 'user-2',
      parent_id: 1,
      content: 'This is a reply',
      mentions: [],
      resolved: false,
      created_at: '2025-11-01T10:05:00Z',
      updated_at: '2025-11-01T10:05:00Z',
      user_email: 'reply@example.com',
      user_name: 'Reply User',
    },
  ];

  const mockOnAddComment = jest.fn();
  const mockOnResolve = jest.fn();
  const mockCurrentUserId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render comment thread', () => {
    render(
      <CommentThread
        comments={mockComments}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    expect(screen.getByText('This is a reply')).toBeInTheDocument();
  });

  it('should display user information', () => {
    render(
      <CommentThread
        comments={mockComments}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Reply User')).toBeInTheDocument();
  });

  it('should render threaded replies correctly', () => {
    render(
      <CommentThread
        comments={mockComments}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    // Reply should be indented/nested under parent
    const replyElement = screen.getByText('This is a reply').closest('[data-indent="true"]');
    expect(replyElement).toBeInTheDocument();
  });

  it('should allow adding a new comment', async () => {
    render(
      <CommentThread
        comments={[]}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    const textarea = screen.getByPlaceholderText(/add a comment/i);
    const submitButton = screen.getByRole('button', { name: /post/i });

    fireEvent.change(textarea, { target: { value: 'New comment' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAddComment).toHaveBeenCalledWith({
        content: 'New comment',
        mentions: [],
      });
    });
  });

  it('should allow replying to a comment', async () => {
    render(
      <CommentThread
        comments={mockComments}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    const replyButton = screen.getAllByRole('button', { name: /reply/i })[0];
    fireEvent.click(replyButton);

    const textarea = screen.getByPlaceholderText(/reply to/i);
    fireEvent.change(textarea, { target: { value: 'My reply' } });

    const submitButton = screen.getByRole('button', { name: /post reply/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAddComment).toHaveBeenCalledWith({
        content: 'My reply',
        parent_id: 1,
        mentions: [],
      });
    });
  });

  it('should allow resolving a comment thread', async () => {
    render(
      <CommentThread
        comments={mockComments}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    const resolveButton = screen.getByRole('button', { name: /resolve/i });
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(mockOnResolve).toHaveBeenCalledWith(1);
    });
  });

  it('should show resolved state', () => {
    const resolvedComments: Comment[] = [
      { ...mockComments[0], resolved: true },
    ];

    render(
      <CommentThread
        comments={resolvedComments}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    expect(screen.getByText(/resolved/i)).toBeInTheDocument();
  });

  it('should handle @mentions', async () => {
    render(
      <CommentThread
        comments={[]}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    const textarea = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(textarea, { target: { value: 'Hey @user123 check this' } });

    const submitButton = screen.getByRole('button', { name: /post/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAddComment).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Hey @user123 check this',
          mentions: expect.arrayContaining(['user123']),
        })
      );
    });
  });

  it('should display relative timestamps', () => {
    render(
      <CommentThread
        comments={mockComments}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    // Should show relative time like "5 minutes ago"
    expect(screen.getAllByText(/ago/i).length).toBeGreaterThan(0);
  });

  it('should not allow empty comments', async () => {
    render(
      <CommentThread
        comments={[]}
        currentUserId={mockCurrentUserId}
        onAddComment={mockOnAddComment}
        onResolve={mockOnResolve}
      />
    );

    const submitButton = screen.getByRole('button', { name: /post/i });
    
    // Button should be disabled when textarea is empty
    expect(submitButton).toBeDisabled();
    
    fireEvent.click(submitButton);
    
    expect(mockOnAddComment).not.toHaveBeenCalled();
  });
});
