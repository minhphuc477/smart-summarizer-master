-- Migration: Add sentiment column to notes table
-- Run this in Supabase SQL Editor

-- Add sentiment column to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT 'neutral';

-- Add check constraint to ensure only valid values
ALTER TABLE notes
ADD CONSTRAINT valid_sentiment 
CHECK (sentiment IN ('positive', 'neutral', 'negative'));

-- Create index for faster filtering by sentiment
CREATE INDEX IF NOT EXISTS idx_notes_sentiment ON notes(sentiment);

-- Optional: Add comment to column
COMMENT ON COLUMN notes.sentiment IS 'Sentiment analysis result: positive, neutral, or negative';
