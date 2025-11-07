-- Migration: Create personas table for saving and reusing AI personas
-- This allows users to save frequently-used personas for quick reuse

-- Create personas table
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
CREATE INDEX IF NOT EXISTS idx_personas_user_default ON personas(user_id, is_default);

-- Add RLS policies
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- Users can only see their own personas
CREATE POLICY "Users can view their own personas"
  ON personas FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own personas
CREATE POLICY "Users can create their own personas"
  ON personas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own personas
CREATE POLICY "Users can update their own personas"
  ON personas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own personas
CREATE POLICY "Users can delete their own personas"
  ON personas FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER personas_updated_at_trigger
  BEFORE UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION update_personas_updated_at();

-- Insert some default personas for existing users (optional)
-- These are just examples, users can create their own
COMMENT ON TABLE personas IS 'Stores user-defined AI personas for quick reuse in summarization';
