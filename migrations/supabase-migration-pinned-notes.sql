-- Migration: Add is_pinned column to notes table
-- This allows users to pin/favorite important notes for quick access

-- Add is_pinned column
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Add index for performance when filtering pinned notes
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON notes(user_id, is_pinned, created_at DESC);

-- Add comment
COMMENT ON COLUMN notes.is_pinned IS 'Whether this note is pinned/favorited by the user';
