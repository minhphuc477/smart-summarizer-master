'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import type { Comment } from '@/lib/realtime/types';

interface CommentThreadProps {
  comments: Comment[];
  currentUserId: string;
  onAddComment: (data: { content: string; parent_id?: number; mentions: string[] }) => Promise<{ data?: unknown; error?: unknown }>;
  onResolve: (commentId: number) => void;
  onDelete?: (commentId: number) => void;
}

export function CommentThread({
  comments,
  currentUserId,
  onAddComment,
  onResolve,
  onDelete,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isReplyPosting, setIsReplyPosting] = useState<number | null>(null);

  // Organize comments into threads
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: number) =>
    comments.filter((c) => c.parent_id === parentId);

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    if (isPosting) return; // prevent double submit

    setIsPosting(true);
    try {
      const mentions = extractMentions(newComment);
      const res = await onAddComment({ content: newComment, mentions });
      if (res && !res.error) {
        setNewComment('');
      } else {
        // keep the content so user can retry
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleReply = async (parentId: number) => {
    if (!replyContent.trim()) return;
    if (isReplyPosting) return;

    setIsReplyPosting(parentId);
    try {
      const mentions = extractMentions(replyContent);
      const res = await onAddComment({ content: replyContent, parent_id: parentId, mentions });
      if (res && !res.error) {
        setReplyContent('');
        setReplyingTo(null);
      } else {
        // keep reply content so user can retry
      }
    } finally {
      setIsReplyPosting(null);
    }
  };

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

  const renderComment = (comment: Comment, isReply = false) => (
    <div
      key={comment.id}
      className={`flex gap-3 ${isReply ? 'ml-12 mt-2' : 'mt-4'}`}
      data-indent={isReply}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={comment.user_avatar} alt={comment.user_name || comment.user_email} />
        <AvatarFallback>
          {getUserInitials(comment.user_name, comment.user_email)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {comment.user_name || comment.user_email}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {comment.resolved && (
            <Badge variant="secondary" className="text-xs">
              Resolved
            </Badge>
          )}
        </div>
        
        <p className="text-sm mt-1">{comment.content}</p>
        
        <div className="flex gap-2 mt-2">
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(comment.id)}
            >
              Reply
            </Button>
          )}
          
          {!comment.resolved && comment.user_id === currentUserId && !isReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResolve(comment.id)}
            >
              Resolve
            </Button>
          )}
          
          {comment.user_id === currentUserId && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(comment.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
        
        {replyingTo === comment.id && (
          <div className="mt-2 flex gap-2">
            <Textarea
              placeholder={`Reply to ${comment.user_name || comment.user_email}...`}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              className="min-h-[60px]"
            />
            <div className="flex flex-col gap-1">
              <Button size="sm" onClick={() => handleReply(comment.id)} disabled={isReplyPosting === comment.id}>
                {isReplyPosting === comment.id ? 'Posting…' : 'Post Reply'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {/* Render replies */}
        {!isReply && getReplies(comment.id).map((reply) => renderComment(reply, true))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comments</h3>
      
      {/* New comment input */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a comment... (use @username to mention someone)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[80px]"
        />
        <Button
          onClick={handleSubmit}
          disabled={!newComment.trim() || isPosting}
        >
          {isPosting ? 'Posting…' : 'Post'}
        </Button>
      </div>
      
      {/* Comments list */}
      {rootComments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-2">
          {rootComments.map((comment) => renderComment(comment))}
        </div>
      )}
    </div>
  );
}
