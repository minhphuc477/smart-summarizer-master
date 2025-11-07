'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

type StickyNoteData = {
  text?: string;
  editing?: boolean;
};

export default function StickyNoteNode({ data, id: _id }: NodeProps<StickyNoteData>) {
  const [text, setText] = useState(data.text || '');
  const [isEditing, setIsEditing] = useState(data.editing !== undefined ? data.editing : true); // Start in editing mode by default for new notes
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    // Update the node data
    if (data.text !== text) {
      data.text = text;
    }
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
          onClick={() => setIsEditing(true)}
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
