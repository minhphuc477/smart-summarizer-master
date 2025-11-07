'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  ThumbsUp, 
  Lightbulb, 
  PartyPopper, 
  MessageSquare, 
  Check, 
  MoreHorizontal,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Reaction {
  id: number;
  reaction_type: 'like' | 'heart' | 'thumbsup' | 'celebrate' | 'insightful';
  user_id: string;
}

interface Comment {
  id: number;
  content: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  created_at: string;
  edited: boolean;
  edited_at?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  mentions: string[];
  reactions: Reaction[];
  replies: Comment[];
}

interface CommentThreadProps {
  comments: Comment[];
  currentUserId: string;
  noteId: string;
  onReply: (commentId: number) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
  onReact: (commentId: number, reactionType: string) => void;
  onResolve: (commentId: number, resolved: boolean) => void;
}

const REACTION_ICONS = {
  like: ThumbsUp,
  heart: Heart,
  thumbsup: ThumbsUp,
  celebrate: PartyPopper,
  insightful: Lightbulb,
};

const REACTION_LABELS = {
  like: 'Like',
  heart: 'Heart',
  thumbsup: 'Thumbs up',
  celebrate: 'Celebrate',
  insightful: 'Insightful',
};

function CommentItem({
  comment,
  currentUserId,
  depth = 0,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onResolve,
}: {
  comment: Comment;
  currentUserId: string;
  depth?: number;
  onReply: (commentId: number) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
  onReact: (commentId: number, reactionType: string) => void;
  onResolve: (commentId: number, resolved: boolean) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const isOwner = comment.user_id === currentUserId;

  // Group reactions by type
  const reactionCounts = comment.reactions.reduce((acc, r) => {
    acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const userReactions = new Set(
    comment.reactions
      .filter(r => r.user_id === currentUserId)
      .map(r => r.reaction_type)
  );

  const handleReaction = (type: string) => {
    onReact(comment.id, type);
    setShowReactions(false);
  };

  return (
    <div
      className={cn(
        'flex gap-3',
        depth > 0 && 'ml-8 pt-4 border-l-2 border-border pl-4'
      )}
    >
      <Avatar className="w-8 h-8 mt-1">
        <AvatarImage src={comment.user_avatar} alt={comment.user_name} />
        <AvatarFallback>
          {comment.user_name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{comment.user_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {comment.edited && (
              <Badge variant="outline" className="text-xs">
                Edited
              </Badge>
            )}
            {comment.resolved && (
              <Badge variant="default" className="text-xs bg-green-600">
                <Check className="w-3 h-3 mr-1" />
                Resolved
              </Badge>
            )}
          </div>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(comment)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(comment.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
          {comment.content}
        </div>

        {/* Reactions */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(reactionCounts).map(([type, count]) => {
              const Icon = REACTION_ICONS[type as keyof typeof REACTION_ICONS];
              const isUserReacted = userReactions.has(type as 'like' | 'heart' | 'thumbsup' | 'celebrate' | 'insightful');
              
              return (
                <Button
                  key={type}
                  variant={isUserReacted ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => handleReaction(type)}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {count}
                </Button>
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onReply(comment.id)}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Reply
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowReactions(!showReactions)}
            >
              <Heart className="w-3 h-3 mr-1" />
              React
            </Button>

            {showReactions && (
              <div className="absolute z-10 mt-1 p-2 bg-popover border rounded-md shadow-lg flex gap-1">
                {Object.entries(REACTION_ICONS).map(([type, Icon]) => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleReaction(type)}
                    title={REACTION_LABELS[type as keyof typeof REACTION_LABELS]}
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                ))}
              </div>
            )}
          </div>

          {depth === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onResolve(comment.id, !comment.resolved)}
            >
              <Check className="w-3 h-3 mr-1" />
              {comment.resolved ? 'Unresolve' : 'Resolve'}
            </Button>
          )}
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-4 mt-4">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                depth={depth + 1}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
                onResolve={onResolve}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread({
  comments,
  currentUserId,
 noteId: _noteId,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onResolve,
}: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No comments yet. Be the first to comment!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReact={onReact}
          onResolve={onResolve}
        />
      ))}
    </div>
  );
}
