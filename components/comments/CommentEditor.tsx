'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, AtSign, Send } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface CommentEditorProps {
  currentUser: User;
  onSubmit: (content: string, mentions: string[]) => void;
  onCancel?: () => void;
  initialContent?: string;
  initialMentions?: string[];
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  workspaceMembers?: User[];
}

export function CommentEditor({
  currentUser,
  onSubmit,
  onCancel,
  initialContent = '',
  initialMentions = [],
  placeholder = 'Write a comment... Use @ to mention someone',
  submitLabel = 'Comment',
  autoFocus = false,
  workspaceMembers = [],
}: CommentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [mentions, setMentions] = useState<string[]>(initialMentions);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [_mentionPosition, _setMentionPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    // Check for @ mentions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Check if we're still in a mention (no space after @)
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionFilter(textAfterAt);
        setShowMentionDropdown(true);

        // Calculate dropdown position
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          _setMentionPosition({
            top: rect.top - 200, // Position above
            left: rect.left,
          });
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (user: User) => {
    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPosition);
    const textAfterCursor = content.slice(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeAt = content.slice(0, lastAtIndex);
      const mentionText = `@[${user.name}](${user.id}) `;
      const newContent = beforeAt + mentionText + textAfterCursor;

      setContent(newContent);
      
      // Add to mentions list if not already there
      if (!mentions.includes(user.id)) {
        setMentions([...mentions, user.id]);
      }

      setShowMentionDropdown(false);

      // Set cursor position after mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = beforeAt.length + mentionText.length;
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const filteredMembers = workspaceMembers.filter(
    (member) =>
      member.id !== currentUser.id &&
      (member.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
        member.email.toLowerCase().includes(mentionFilter.toLowerCase()))
  );

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim(), mentions);
      setContent('');
      setMentions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // Allow default behavior
      return;
    }
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    // Close mention dropdown on Escape
    if (e.key === 'Escape' && showMentionDropdown) {
      e.preventDefault();
      setShowMentionDropdown(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Avatar className="w-8 h-8 mt-1">
          <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
          <AvatarFallback>
            {currentUser.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[80px] resize-none"
              rows={3}
            />

            {/* Mention dropdown */}
            {showMentionDropdown && filteredMembers.length > 0 && (
              <div
                className="absolute bottom-full mb-2 w-full max-w-md bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto z-50"
              >
                <div className="p-2 text-xs text-muted-foreground border-b flex items-center gap-1">
                  <AtSign className="w-3 h-3" />
                  Mention someone
                </div>
                <div className="p-1">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => insertMention(member)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-sm text-left"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback>
                          {member.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {member.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mentioned users */}
          {mentions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mentions.map((userId) => {
                const user = workspaceMembers.find(m => m.id === userId);
                if (!user) return null;

                return (
                  <div
                    key={userId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-full text-xs"
                  >
                    <AtSign className="w-3 h-3" />
                    {user.name}
                    <button
                      type="button"
                      onClick={() => {
                        setMentions(mentions.filter(id => id !== userId));
                        // Also remove from content
                        const newContent = content.replace(
                          new RegExp(`@\\[${user.name}\\]\\(${userId}\\)`, 'g'),
                          ''
                        );
                        setContent(newContent);
                      }}
                      className="hover:bg-secondary-foreground/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Tip: Use <kbd className="px-1 py-0.5 bg-muted rounded">@</kbd> to mention,{' '}
              <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+Enter</kbd> to submit
            </div>

            <div className="flex gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={!content.trim()}
              >
                <Send className="w-4 h-4 mr-1" />
                {submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
