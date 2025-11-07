-- Migration: Add updated_at column to notes to satisfy triggers
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Optional: ensure sentiment column exists (if not previously defined)
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS sentiment text;

-- We intentionally DO NOT add a tags column because tags are normalized via tags & note_tags tables.
