import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Comment, PresenceState } from './types';

export class RealtimeCollaboration {
  private supabase: SupabaseClient;
  private noteId: string;
  private channels: Map<string, RealtimeChannel> = new Map();

  constructor(supabase: SupabaseClient, noteId: string) {
    this.supabase = supabase;
    this.noteId = noteId;
  }

  // ==================== COMMENTS ====================

  async subscribeToComments(callback: (comment: Comment) => void) {
    const channelName = `comments:${this.noteId}`;
    
    const channel = this.supabase.channel(channelName);
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `note_id=eq.${this.noteId}`,
        },
        (payload) => {
          callback(payload.new as Comment);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  async addComment(data: {
    content: string;
    parent_id?: number;
    mentions?: string[];
  }) {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    return this.supabase
      .from('comments')
      .insert({
        note_id: parseInt(this.noteId),
        user_id: user.user.id,
        content: data.content,
        parent_id: data.parent_id,
        mentions: data.mentions || [],
      })
      .select()
      .single();
  }

  async resolveComment(commentId: number) {
    return this.supabase
      .from('comments')
      .update({ resolved: true })
      .eq('id', commentId)
      .select()
      .single();
  }

  async getComments() {
    return this.supabase
      .from('comments')
      .select(`
        *,
        user:user_id (
          email,
          raw_user_meta_data
        )
      `)
      .eq('note_id', this.noteId)
      .order('created_at', { ascending: true });
  }

  // ==================== PRESENCE ====================

  async joinPresence(userData: {
    name?: string;
    avatar?: string;
    status?: 'viewing' | 'editing' | 'idle';
  }) {
    const channelName = `presence:${this.noteId}`;
    
    const channel = this.supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        // Presence state synced
      })
      .on('presence', { event: 'join' }, ({ key: _key, newPresences: _newPresences }) => {
        // User joined
      })
      .on('presence', { event: 'leave' }, ({ key: _key, leftPresences: _leftPresences }) => {
        // User left
      });

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          ...userData,
          status: userData.status || 'viewing',
          online_at: new Date().toISOString(),
        });
      }
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  async subscribeToPresence(callback: (presence: PresenceState[]) => void) {
    const channelName = `presence:${this.noteId}`;
    
    const channel = this.supabase.channel(channelName);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: PresenceState[] = [];
        
        Object.values(presenceState).forEach((presences: unknown) => {
          if (Array.isArray(presences)) {
            presences.forEach((presence) => {
              users.push(presence as PresenceState);
            });
          }
        });
        
        callback(users);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  async updateCursorPosition(position: { x: number; y: number }) {
    const channelName = `presence:${this.noteId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      // Update cursor position in presence state
      await channel.track({
        cursor_position: position,
      });
    }
  }

  async updateSelection(selection: { start: { x: number; y: number }; end: { x: number; y: number } } | null) {
    const channelName = `presence:${this.noteId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      await channel.track({
        selection: selection || undefined,
      });
    }
  }

  async updateTypingStatus(typing: boolean) {
    const channelName = `presence:${this.noteId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      await channel.track({
        typing,
      });
    }
  }

  async updateFocusedElement(elementId: string | null) {
    const channelName = `presence:${this.noteId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      await channel.track({
        focused_element: elementId || undefined,
      });
    }
  }

  async updateStatus(status: 'viewing' | 'editing' | 'idle') {
    const channelName = `presence:${this.noteId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      await channel.track({
        status,
      });
    }
  }

  async leavePresence() {
    const channelName = `presence:${this.noteId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      await channel.untrack();
    }
  }

  // ==================== VERSION HISTORY ====================

  async getVersionHistory() {
    return this.supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', this.noteId)
      .order('version_number', { ascending: false });
  }

  async restoreVersion(versionId: number) {
    // Get the version data
    const { data: version, error: versionError } = await this.supabase
      .from('note_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
      return { data: null, error: versionError };
    }

    // Update the note with version data
    return this.supabase
      .from('notes')
      .update({
        original_notes: version.original_notes,
        summary: version.summary,
        takeaways: version.takeaways,
        actions: version.actions,
        tags: version.tags,
        sentiment: version.sentiment,
      })
      .eq('id', this.noteId)
      .select()
      .single();
  }

  // ==================== CANVAS COLLABORATION ====================

  /**
   * Subscribe to canvas node updates for collaborative editing
   */
  async subscribeToCanvasUpdates(
    callback: (update: {
      userId: string;
      nodeId: string;
      action: 'update' | 'delete' | 'create';
      data?: unknown;
    }) => void
  ) {
    const channelName = `canvas:${this.noteId}`;
    
    const channel = this.supabase.channel(channelName);
    
    channel
      .on('broadcast', { event: 'node_update' }, ({ payload }) => {
        callback(payload as Parameters<typeof callback>[0]);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Broadcast a canvas node update to other collaborators
   */
  async broadcastCanvasUpdate(
    nodeId: string,
    action: 'update' | 'delete' | 'create',
    data?: unknown
  ) {
    const channelName = `canvas:${this.noteId}`;
    let channel = this.channels.get(channelName);
    
    if (!channel) {
      channel = this.supabase.channel(channelName);
      await channel.subscribe();
      this.channels.set(channelName, channel);
    }

    const { data: user } = await this.supabase.auth.getUser();
    
    await channel.send({
      type: 'broadcast',
      event: 'node_update',
      payload: {
        userId: user.user?.id || 'anonymous',
        nodeId,
        action,
        data,
      },
    });
  }

  /**
   * Lock a canvas node for editing (prevents conflicts)
   */
  async lockCanvasNode(nodeId: string) {
    const channelName = `canvas:${this.noteId}`;
    let channel = this.channels.get(channelName);
    
    if (!channel) {
      channel = this.supabase.channel(channelName);
      await channel.subscribe();
      this.channels.set(channelName, channel);
    }

    const { data: user } = await this.supabase.auth.getUser();
    
    await channel.send({
      type: 'broadcast',
      event: 'node_lock',
      payload: {
        userId: user.user?.id || 'anonymous',
        nodeId,
        locked: true,
      },
    });
  }

  /**
   * Unlock a canvas node
   */
  async unlockCanvasNode(nodeId: string) {
    const channelName = `canvas:${this.noteId}`;
    const channel = this.channels.get(channelName);
    
    if (!channel) return;

    const { data: user } = await this.supabase.auth.getUser();
    
    await channel.send({
      type: 'broadcast',
      event: 'node_lock',
      payload: {
        userId: user.user?.id || 'anonymous',
        nodeId,
        locked: false,
      },
    });
  }

  /**
   * Subscribe to node lock events
   */
  async subscribeToNodeLocks(
    callback: (lock: { userId: string; nodeId: string; locked: boolean }) => void
  ) {
    const channelName = `canvas:${this.noteId}`;
    
    const channel = this.supabase.channel(channelName);
    
    channel
      .on('broadcast', { event: 'node_lock' }, ({ payload }) => {
        callback(payload as Parameters<typeof callback>[0]);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // ==================== NOTIFICATIONS ====================

  async getNotifications() {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user.user) {
      return { data: [], error: null };
    }

    return this.supabase
      .from('comment_notifications')
      .select('*')
      .eq('user_id', user.user.id)
      .eq('read', false)
      .order('created_at', { ascending: false });
  }

  async markNotificationRead(notificationId: number) {
    return this.supabase
      .from('comment_notifications')
      .update({ read: true })
      .eq('id', notificationId);
  }

  // ==================== CLEANUP ====================

  async cleanup() {
    // Unsubscribe from all channels
    for (const [, channel] of this.channels) {
      await channel.unsubscribe();
    }
    this.channels.clear();
  }
}
