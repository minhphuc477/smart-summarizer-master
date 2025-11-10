'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

type StickyNoteData = {
  text?: string;
  editing?: boolean;
};

export default function StickyNoteNode({ data, id: _id }: NodeProps<StickyNoteData>) {
  const [text, setText] = useState(data.text || '');
  // Start editing if the node's data requests it (used when converting from default node)
  const [isEditing, setIsEditing] = useState<boolean>(() => Boolean(data.editing));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync text when data.text changes (e.g., when loading a template)
  useEffect(() => {
    if (data.text !== undefined && data.text !== text && !isEditing) {
      setText(data.text);
    }
  }, [data.text, text, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // If parent sets data.editing to true (e.g., conversion), enter edit mode
  useEffect(() => {
    if (data.editing) setIsEditing(true);
  }, [data.editing]);

  const handleBlur = () => {
    setIsEditing(false);
    // Update the node data
    if (data.text !== text) {
      data.text = text;
    }
    // Ensure editing flag is cleared in node data
    if (data.editing) data.editing = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop propagation to prevent React Flow from capturing these keys
    e.stopPropagation();
    
    // Allow Escape to finish editing
    if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
    // Don't let Enter create new lines unless Shift is pressed
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div
      className="sticky-note-node"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none bg-transparent border-none outline-none p-2 text-sm font-handwriting"
          style={{
            fontFamily: 'Comic Sans MS, cursive',
            lineHeight: '1.5',
          }}
          placeholder="Type your note..."
        />
      ) : (
        <div
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className="w-full h-full p-2 text-sm cursor-text whitespace-pre-wrap break-words"
          style={{
            fontFamily: 'Comic Sans MS, cursive',
            lineHeight: '1.5',
          }}
        >
          {text || 'Click to edit'}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
