"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeCollaboration } from '@/lib/realtime/collaboration';
import type { PresenceState } from '@/lib/realtime/types';
import { OTClient, type Operation } from '@/lib/realtime/ot';

interface UseCollaborativeCanvasOptions {
  noteId: number;
  userId: string;
  userName?: string;
  userAvatar?: string;
  enabled?: boolean;
}

interface NodeUpdate {
  userId: string;
  nodeId: string;
  action: 'update' | 'delete' | 'create';
  data?: unknown;
}

export function useCollaborativeCanvas({
  noteId,
  userId,
  userName,
  userAvatar,
  enabled = true,
}: UseCollaborativeCanvasOptions) {
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [nodeLocks, setNodeLocks] = useState<Map<string, string>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const collaborationRef = useRef<RealtimeCollaboration | null>(null);
  const otClientRef = useRef<OTClient | null>(null);

  // Initialize collaboration client
  useEffect(() => {
    if (!enabled) return;

    // Get Supabase client
    const getSupabase = async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const collaboration = new RealtimeCollaboration(supabase, noteId.toString());
      collaborationRef.current = collaboration;
      otClientRef.current = new OTClient('');

      // Join presence
      collaboration
        .joinPresence({
          name: userName,
          avatar: userAvatar,
          status: 'viewing',
        })
        .then(() => {
          setIsConnected(true);
        })
        .catch((error) => {
          console.error('Failed to join presence:', error);
        });

      // Subscribe to presence updates
      collaboration.subscribeToPresence((users) => {
        setPresence(users);
      });

      // Subscribe to node locks
      collaboration.subscribeToNodeLocks((lock) => {
        setNodeLocks((prev) => {
          const updated = new Map(prev);
          if (lock.locked) {
            updated.set(lock.nodeId, lock.userId);
          } else {
            updated.delete(lock.nodeId);
          }
          return updated;
        });
      });
    };

    getSupabase();

    // Cleanup
    return () => {
      if (collaborationRef.current) {
        collaborationRef.current.leavePresence();
        collaborationRef.current.cleanup();
      }
    };
  }, [enabled, noteId, userName, userAvatar]);

  // Update cursor position
  const updateCursorPosition = useCallback(
    (position: { x: number; y: number }) => {
      if (!enabled || !collaborationRef.current) return;
      collaborationRef.current.updateCursorPosition(position);
    },
    [enabled]
  );

  // Update selection
  const updateSelection = useCallback(
    (selection: { start: { x: number; y: number }; end: { x: number; y: number } } | null) => {
      if (!enabled || !collaborationRef.current) return;
      collaborationRef.current.updateSelection(selection);
    },
    [enabled]
  );

  // Update typing status
  const updateTypingStatus = useCallback(
    (typing: boolean) => {
      if (!enabled || !collaborationRef.current) return;
      collaborationRef.current.updateTypingStatus(typing);
    },
    [enabled]
  );

  // Update focused element
  const updateFocusedElement = useCallback(
    (elementId: string | null) => {
      if (!enabled || !collaborationRef.current) return;
      collaborationRef.current.updateFocusedElement(elementId);
    },
    [enabled]
  );

  // Update status
  const updateStatus = useCallback(
    (status: 'viewing' | 'editing' | 'idle') => {
      if (!enabled || !collaborationRef.current) return;
      collaborationRef.current.updateStatus(status);
    },
    [enabled]
  );

  // Lock a canvas node
  const lockNode = useCallback(
    async (nodeId: string) => {
      if (!enabled || !collaborationRef.current) return false;
      
      // Check if already locked by someone else
      const existingLock = nodeLocks.get(nodeId);
      if (existingLock && existingLock !== userId) {
        return false;
      }

      await collaborationRef.current.lockCanvasNode(nodeId);
      return true;
    },
    [enabled, nodeLocks, userId]
  );

  // Unlock a canvas node
  const unlockNode = useCallback(
    async (nodeId: string) => {
      if (!enabled || !collaborationRef.current) return;
      await collaborationRef.current.unlockCanvasNode(nodeId);
    },
    [enabled]
  );

  // Check if a node is locked by someone else
  const isNodeLocked = useCallback(
    (nodeId: string) => {
      const lockUserId = nodeLocks.get(nodeId);
      return lockUserId ? lockUserId !== userId : false;
    },
    [nodeLocks, userId]
  );

  // Get who locked a node
  const getNodeLockOwner = useCallback(
    (nodeId: string) => {
      return nodeLocks.get(nodeId);
    },
    [nodeLocks]
  );

  // Subscribe to canvas updates
  const subscribeToCanvasUpdates = useCallback(
    (callback: (update: NodeUpdate) => void) => {
      if (!enabled || !collaborationRef.current) return;
      collaborationRef.current.subscribeToCanvasUpdates(callback);
    },
    [enabled]
  );

  // Broadcast canvas update
  const broadcastCanvasUpdate = useCallback(
    async (nodeId: string, action: 'update' | 'delete' | 'create', data?: unknown) => {
      if (!enabled || !collaborationRef.current) return;
      await collaborationRef.current.broadcastCanvasUpdate(nodeId, action, data);
    },
    [enabled]
  );

  // Apply local operation with OT
  const applyLocalOperation = useCallback(
    (operation: Operation) => {
      if (!otClientRef.current) return;
      otClientRef.current.applyLocalOperation(operation);
    },
    []
  );

  // Apply remote operation with OT
  const applyRemoteOperation = useCallback(
    (operation: Operation, version: number) => {
      if (!otClientRef.current) return;
      otClientRef.current.applyServerOperation(operation, version);
    },
    []
  );

  // Get active users (excluding current user)
  const activeUsers = presence.filter((p) => p.user_id !== userId);

  // Get users editing specific elements
  const getUsersEditingElement = useCallback(
    (elementId: string) => {
      return presence.filter((p) => p.focused_element === elementId);
    },
    [presence]
  );

  return {
    // State
    presence,
    activeUsers,
    nodeLocks,
    isConnected,

    // Presence methods
    updateCursorPosition,
    updateSelection,
    updateTypingStatus,
    updateFocusedElement,
    updateStatus,

    // Node locking
    lockNode,
    unlockNode,
    isNodeLocked,
    getNodeLockOwner,

    // Canvas updates
    subscribeToCanvasUpdates,
    broadcastCanvasUpdate,

    // Operational transformation
    applyLocalOperation,
    applyRemoteOperation,
    otClient: otClientRef.current,

    // Utility
    getUsersEditingElement,
  };
}

/**
 * Hook to track cursor movements and broadcast them
 */
export function useCursorBroadcast(
  updateCursorPosition: (position: { x: number; y: number }) => void,
  enabled: boolean = true,
  throttleMs: number = 50
) {
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSentRef.current < throttleMs) return;

      updateCursorPosition({
        x: e.clientX,
        y: e.clientY,
      });
      lastSentRef.current = now;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, updateCursorPosition, throttleMs]);
}
