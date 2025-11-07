/**
 * Presence Indicator Component
 * 
 * Shows real-time presence of other users viewing/editing a note.
 * Displays user avatars with status indicators.
 */

'use client'

import { usePresence } from '@/lib/useRealtime'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'
import { Eye, Edit3, Circle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface PresenceIndicatorProps {
  noteId: string | null
  className?: string
}

export function PresenceIndicator({ noteId, className = '' }: PresenceIndicatorProps) {
  const { presenceUsers, isConnected } = usePresence(noteId)

  if (!noteId || !isConnected || presenceUsers.length === 0) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'editing':
        return <Edit3 className="h-3 w-3" />
      case 'viewing':
        return <Eye className="h-3 w-3" />
      default:
        return <Circle className="h-3 w-3" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'editing':
        return 'bg-green-500'
      case 'viewing':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'editing':
        return 'Editing'
      case 'viewing':
        return 'Viewing'
      default:
        return 'Idle'
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="presence-indicator">
      <TooltipProvider>
        <div className="flex items-center -space-x-2">
          {presenceUsers.slice(0, 5).map((user) => {
            const initials =
              user.user_name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase() ||
              user.user_email?.[0]?.toUpperCase() ||
              '?'

            return (
              <Tooltip key={user.user_id}>
                <TooltipTrigger>
                  <div className="relative">
                    <Avatar className="h-8 w-8 border-2 border-background">
                      <AvatarImage src={user.user_avatar} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(user.status)}`}
                      title={getStatusText(user.status)}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-medium">{user.user_name || user.user_email}</p>
                    <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                      {getStatusIcon(user.status)}
                      <span>{getStatusText(user.status)}</span>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Active {formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}

          {presenceUsers.length > 5 && (
            <Tooltip>
              <TooltipTrigger>
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="text-xs">+{presenceUsers.length - 5}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{presenceUsers.length - 5} more users online</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>

      {presenceUsers.length > 0 && (
        <Badge variant="secondary" className="text-xs">
          {presenceUsers.length} online
        </Badge>
      )}
    </div>
  )
}
