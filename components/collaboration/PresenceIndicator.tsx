'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { PresenceState } from '@/lib/realtime/types';

interface PresenceIndicatorProps {
  presence: PresenceState[];
  showCursors?: boolean;
}

export function PresenceIndicator({ presence, showCursors = false }: PresenceIndicatorProps) {
  if (presence.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No one else is viewing this note
      </div>
    );
  }

  const getUserInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'editing':
        return 'bg-green-500';
      case 'viewing':
        return 'bg-blue-500';
      case 'idle':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'editing':
        return 'Editing';
      case 'viewing':
        return 'Viewing';
      case 'idle':
        return 'Idle';
      default:
        return 'Online';
    }
  };

  // Sort by status priority: editing > viewing > idle
  const statusPriority = { editing: 0, viewing: 1, idle: 2 };
  const sortedPresence = [...presence].sort(
    (a, b) => statusPriority[a.status] - statusPriority[b.status]
  );

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <div className="flex -space-x-2">
          {sortedPresence.map((user) => (
            <Tooltip key={user.user_id}>
              <TooltipTrigger>
                <div
                  className="relative"
                  data-user-id={user.user_id}
                  data-status={user.status}
                >
                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarImage
                      src={user.user_avatar}
                      alt={user.user_name || user.user_email}
                    />
                    <AvatarFallback>
                      {getUserInitials(user.user_name, user.user_email)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background ${getStatusColor(user.status)}`}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent data-tooltip={`${user.user_email} - ${getStatusLabel(user.status)}`}>
                <div className="text-xs">
                  <div className="font-medium truncate max-w-[200px]">
                    {user.user_name || user.user_email}
                  </div>
                  <div className="text-muted-foreground">{getStatusLabel(user.status)}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      <div className="text-sm text-muted-foreground">
        {presence.length} {presence.length === 1 ? 'user' : 'users'} online
      </div>

      {showCursors &&
        presence.map((user) =>
          user.cursor_position ? (
            <div
              key={user.user_id}
              data-cursor-user={user.user_id}
              className="absolute pointer-events-none z-50"
              style={{
                left: user.cursor_position.x,
                top: user.cursor_position.y,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5.5 3L17 14.5L12 16L9 20L7 18L8.5 13L5.5 3Z"
                  fill={user.status === 'editing' ? '#10b981' : '#3b82f6'}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              <Badge
                className="ml-5 -mt-4 text-xs truncate max-w-[120px]"
                style={{
                  backgroundColor: user.status === 'editing' ? '#10b981' : '#3b82f6',
                }}
              >
                {user.user_name || user.user_email}
              </Badge>
            </div>
          ) : null
        )}
    </div>
  );
}
