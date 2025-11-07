import { RealtimeCollaboration } from '../collaboration';
import { createBrowserClient } from '@supabase/ssr';

// Mock Supabase client
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
}));

describe('RealtimeCollaboration', () => {
  let mockSupabase: any;
  let collaboration: RealtimeCollaboration;
  const mockNoteId = '123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    // Create a factory for mock channels
    const createMockChannel = () => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callback) => {
        // Call the callback immediately with 'SUBSCRIBED' status
        if (callback) {
          callback('SUBSCRIBED');
        }
        return Promise.resolve({ error: null });
      }),
      unsubscribe: jest.fn().mockResolvedValue({ error: null }),
      send: jest.fn(),
      track: jest.fn().mockResolvedValue({ error: null }),
      untrack: jest.fn().mockResolvedValue({ error: null }),
      presenceState: jest.fn().mockReturnValue({}),
    });

    // Create mock Supabase client
    mockSupabase = {
      channel: jest.fn(createMockChannel),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
    };

    (createBrowserClient as jest.Mock).mockReturnValue(mockSupabase);
    
    collaboration = new RealtimeCollaboration(mockSupabase, mockNoteId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Comments', () => {
    it('should subscribe to comment updates', async () => {
      const callback = jest.fn();
      
      await collaboration.subscribeToComments(callback);
      
      const channel = mockSupabase.channel.mock.results[0].value;
      expect(mockSupabase.channel).toHaveBeenCalledWith(
        expect.stringContaining('comments:')
      );
      expect(channel.on).toHaveBeenCalled();
      expect(channel.subscribe).toHaveBeenCalled();
    });

    it('should add a comment', async () => {
      const commentData = {
        content: 'Test comment',
        mentions: [],
      };
      
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: { id: 1, ...commentData },
        error: null,
      });
      
      const result = await collaboration.addComment(commentData);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('comments');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          note_id: parseInt(mockNoteId),
          content: commentData.content,
        })
      );
      expect(result.data).toHaveProperty('content', 'Test comment');
    });

    it('should add a threaded reply', async () => {
      const replyData = {
        content: 'Reply to comment',
        parent_id: 1,
        mentions: [],
      };
      
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: { id: 2, ...replyData },
        error: null,
      });
      
      const result = await collaboration.addComment(replyData);
      
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_id: 1,
        })
      );
      expect(result.data?.parent_id).toBe(1);
    });

    it('should resolve a comment', async () => {
      const commentId = 1;
      
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: { id: commentId, resolved: true },
        error: null,
      });
      
      const result = await collaboration.resolveComment(commentId);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('comments');
      expect(mockSupabase.update).toHaveBeenCalledWith({ resolved: true });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', commentId);
      expect(result.data?.resolved).toBe(true);
    });

    it('should handle comment errors', async () => {
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });
      
      const result = await collaboration.addComment({ content: 'Test' });
      
      expect(result.error).toBeTruthy();
      expect(result.error?.message).toBe('Insert failed');
    });
  });

  describe('Presence', () => {
    it('should join presence channel', async () => {
      const userData = { name: 'Test User', avatar: 'avatar.jpg' };
      
      await collaboration.joinPresence(userData);
      
      const channel = mockSupabase.channel.mock.results[0].value;
      expect(mockSupabase.channel).toHaveBeenCalledWith(
        expect.stringContaining('presence:')
      );
      expect(channel.track).toHaveBeenCalledWith(
        expect.objectContaining(userData)
      );
    });

    it('should subscribe to presence updates', async () => {
      const callback = jest.fn();
      
      await collaboration.subscribeToPresence(callback);
      
      const channel = mockSupabase.channel.mock.results[0].value;
      expect(channel.on).toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({ event: 'sync' }),
        expect.any(Function)
      );
    });

    it('should update cursor position', async () => {
      const position = { x: 100, y: 200 };
      
      // First join presence to create the channel
      await collaboration.joinPresence({ name: 'Test' });
      await collaboration.updateCursorPosition(position);
      
      // The channel's send method should be called
      const channel = mockSupabase.channel.mock.results[0].value;
      expect(channel.send).toHaveBeenCalled();
    });

    it('should leave presence', async () => {
      await collaboration.joinPresence({ name: 'Test' });
      await collaboration.leavePresence();
      
      const channel = mockSupabase.channel.mock.results[0].value;
      expect(channel.untrack).toHaveBeenCalled();
    });
  });

  describe('Version History', () => {
    it('should fetch version history', async () => {
      const mockVersions = [
        { id: 1, version_number: 1, summary: 'Version 1' },
        { id: 2, version_number: 2, summary: 'Version 2' },
      ];
      
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.order.mockResolvedValue({
        data: mockVersions,
        error: null,
      });
      
      const result = await collaboration.getVersionHistory();
      
      expect(mockSupabase.from).toHaveBeenCalledWith('note_versions');
      expect(mockSupabase.eq).toHaveBeenCalledWith('note_id', mockNoteId);
      expect(result.data).toHaveLength(2);
    });

    it('should restore a specific version', async () => {
      const versionId = 1;
      const versionData = {
        id: versionId,
        note_id: parseInt(mockNoteId),
        user_id: mockUserId,
        version_number: 1,
        original_notes: 'Old content',
        summary: 'Old summary',
        takeaways: [],
        actions: [],
        created_at: new Date().toISOString(),
      };
      
      // First call: fetch version
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: versionData,
          error: null,
        }),
      });
      
      // Second call: update note
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { 
            id: parseInt(mockNoteId), 
            original_notes: versionData.original_notes,
            summary: versionData.summary,
            takeaways: versionData.takeaways,
            actions: versionData.actions,
          },
          error: null,
        }),
      });
      
      const result = await collaboration.restoreVersion(versionId);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('note_versions');
      expect(mockSupabase.from).toHaveBeenCalledWith('notes');
      expect(result.error).toBeNull();
    });

    it('should handle version not found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Version not found' },
        }),
      });
      
      const result = await collaboration.restoreVersion(999);
      
      expect(result.error).toBeTruthy();
    });
  });

  describe('Notifications', () => {
    it('should fetch unread notifications', async () => {
      const mockNotifications = [
        { id: 1, comment_id: 1, read: false },
        { id: 2, comment_id: 2, read: false },
      ];
      
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.order.mockResolvedValue({
        data: mockNotifications,
        error: null,
      });
      
      const result = await collaboration.getNotifications();
      
      expect(mockSupabase.from).toHaveBeenCalledWith('comment_notifications');
      expect(result.data).toHaveLength(2);
    });

    it('should mark notification as read', async () => {
      const notificationId = 1;
      
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({
        data: { id: notificationId, read: true },
        error: null,
      });
      
      await collaboration.markNotificationRead(notificationId);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('comment_notifications');
      expect(mockSupabase.update).toHaveBeenCalledWith({ read: true });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe all channels on cleanup', async () => {
      await collaboration.subscribeToComments(jest.fn());
      await collaboration.subscribeToPresence(jest.fn());
      
      await collaboration.cleanup();
      
      // Check that unsubscribe was called on each created channel
      const channelCalls = mockSupabase.channel.mock.results;
      expect(channelCalls.length).toBeGreaterThan(0);
      channelCalls.forEach((result: any) => {
        expect(result.value.unsubscribe).toHaveBeenCalled();
      });
    });
  });
});
