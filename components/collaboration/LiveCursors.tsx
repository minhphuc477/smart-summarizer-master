"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PresenceState } from '@/lib/realtime/types';

interface LiveCursorProps {
  presence: PresenceState[];
}

interface CursorPosition {
  x: number;
  y: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  color: string;
  timestamp: number;
}

const CURSOR_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Orange
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
];

export function LiveCursors({ presence }: LiveCursorProps) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());

  // Assign consistent colors to users
  const getUserColor = (userId: string) => {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return CURSOR_COLORS[hash % CURSOR_COLORS.length];
  };

  useEffect(() => {
    const newCursors = new Map<string, CursorPosition>();

    presence.forEach((user) => {
      if (user.cursor_position && user.status === 'editing') {
        newCursors.set(user.user_id, {
          x: user.cursor_position.x,
          y: user.cursor_position.y,
          userId: user.user_id,
          userName: user.user_name || user.user_email || 'Anonymous',
          userAvatar: user.user_avatar,
          color: getUserColor(user.user_id),
          timestamp: Date.now(),
        });
      }
    });

    setCursors(newCursors);
  }, [presence]);

  // Clean up stale cursors (older than 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const updated = new Map(prev);
        let changed = false;

        updated.forEach((cursor, userId) => {
          if (now - cursor.timestamp > 5000) {
            updated.delete(userId);
            changed = true;
          }
        });

        return changed ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {Array.from(cursors.values()).map((cursor) => (
          <motion.div
            key={cursor.userId}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: cursor.x,
              top: cursor.y,
              pointerEvents: 'none',
            }}
          >
            {/* Cursor SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            >
              <path
                d="M5.65376 12.3673L13.0564 15.9926L10.7273 20.6818L12.3677 21.5227L14.6969 16.8336L20.4181 18.5227L21.2589 16.8823L5.65376 12.3673Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* User label */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="absolute left-5 top-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName.split(' ')[0]}
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook to track and broadcast cursor position
 */
export function useCursorTracking(
  enabled: boolean,
  onCursorMove?: (position: { x: number; y: number }) => void,
  throttleMs: number = 50
) {
  const [lastSent, setLastSent] = useState(0);

  useEffect(() => {
    if (!enabled || !onCursorMove) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSent < throttleMs) return;

      onCursorMove({
        x: e.clientX,
        y: e.clientY,
      });
      setLastSent(now);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, onCursorMove, throttleMs, lastSent]);
}

/**
 * Selection highlight component for showing what other users have selected
 */
interface SelectionHighlightProps {
  presence: PresenceState[];
}

export function SelectionHighlights({ presence }: SelectionHighlightProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {presence.map((user) => {
        if (!user.selection || user.status !== 'editing') return null;

        const color = CURSOR_COLORS[
          user.user_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) %
            CURSOR_COLORS.length
        ];

        return (
          <div
            key={user.user_id}
            className="absolute rounded"
            style={{
              left: user.selection.start.x,
              top: user.selection.start.y,
              width: user.selection.end.x - user.selection.start.x,
              height: user.selection.end.y - user.selection.start.y,
              backgroundColor: color,
              opacity: 0.2,
              border: `2px solid ${color}`,
            }}
          />
        );
      })}
    </div>
  );
}
