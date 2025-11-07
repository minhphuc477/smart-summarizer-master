/**
 * Comments Panel Component
 * 
 * Displays threaded comments with real-time updates,
 * @mentions, and resolve/unresolve functionality.
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { useComments, type Comment } from '@/lib/useRealtime'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import {
  MessageSquare,
  Send,
  Reply,
  Trash2,
  Edit2,
  Check,
  X,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CommentsPanelProps {
  noteId: string | null
  onClose?: () => void
}

export function CommentsPanel({ noteId, onClose }: CommentsPanelProps) {
  const { comments, loading, addComment, updateComment, deleteComment, toggleResolved } =
    useComments(noteId)
  const [newCommentContent, setNewCommentContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when replying
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [replyingTo])

  const handleAddComment = async () => {
    if (!newCommentContent.trim()) return

    await addComment(newCommentContent, replyingTo || undefined)
    setNewCommentContent('')
    setReplyingTo(null)
  }

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return

    await updateComment(commentId, editContent)
    setEditingId(null)
    setEditContent('')
  }

  const handleDeleteComment = async (commentId: string) => {
    if (confirm('Delete this comment?')) {
      await deleteComment(commentId)
    }
  }

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const isEditing = editingId === comment.id
    const initials =
      comment.user_name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || comment.user_email?.[0]?.toUpperCase() || '?'

    return (
      <div
        key={comment.id}
        className={`${isReply ? 'ml-8 mt-3' : 'mb-4'}`}
        data-testid={`comment-${comment.id}`}
      >
        <Card className={comment.resolved ? 'opacity-60' : ''}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.user_avatar} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {comment.user_name || comment.user_email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.resolved && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolved
                    </Badge>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[80px]"
                      placeholder="Edit your comment..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateComment(comment.id)}
                        disabled={!editContent.trim()}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReplyingTo(comment.id)}
                        className="h-7 px-2"
                      >
                        <Reply className="h-3 w-3 mr-1" />
                        Reply
                      </Button>

                      {!isReply && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleResolved(comment.id, !comment.resolved)}
                          className="h-7 px-2"
                        >
                          {comment.resolved ? (
                            <>
                              <Circle className="h-3 w-3 mr-1" />
                              Unresolve
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Resolve
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(comment)}
                        className="h-7 px-2"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="h-7 px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-3 mt-3">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}

        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="ml-8 mt-3">
            <Card>
              <CardContent className="p-3">
                <Textarea
                  ref={textareaRef}
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[80px] mb-2"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!newCommentContent.trim()}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Reply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  if (!noteId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a note to view comments</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-testid="comments-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="font-semibold">
            Comments {comments.length > 0 && `(${comments.length})`}
          </h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-4">{comments.map((comment) => renderComment(comment))}</div>
        )}
      </div>

      {/* New comment form */}
      {!replyingTo && (
        <div className="p-4 border-t">
          <Textarea
            value={newCommentContent}
            onChange={(e) => setNewCommentContent(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[100px] mb-3"
          />
          <Button onClick={handleAddComment} disabled={!newCommentContent.trim()}>
            <Send className="h-4 w-4 mr-2" />
            Comment
          </Button>
        </div>
      )}
    </div>
  )
}
