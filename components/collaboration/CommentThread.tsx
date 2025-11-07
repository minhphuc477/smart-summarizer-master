'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Comment } from '@/lib/realtime/types';

interface CommentThreadProps {
  comments: Comment[];
  currentUserId: string;
  onAddComment: (data: { content: string; parent_id?: number; mentions: string[] }) => void;
  onResolve: (commentId: number) => void;
}

export function CommentThread({
  comments,
  currentUserId,
  onAddComment,
  onResolve,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');

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

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    
    const mentions = extractMentions(newComment);
    onAddComment({ content: newComment, mentions });
    setNewComment('');
  };

  const handleReply = (parentId: number) => {
    if (!replyContent.trim()) return;
    
    const mentions = extractMentions(replyContent);
    onAddComment({ content: replyContent, parent_id: parentId, mentions });
    setReplyContent('');
    setReplyingTo(null);
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
              <Button size="sm" onClick={() => handleReply(comment.id)}>
                Post Reply
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
          disabled={!newComment.trim()}
        >
          Post
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
