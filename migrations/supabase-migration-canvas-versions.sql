-- Canvas Versions Migration
-- Creates a canvas_versions table to store snapshots of canvas state over time

CREATE TABLE IF NOT EXISTS public.canvas_versions (
  id BIGSERIAL PRIMARY KEY,
  canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,

  -- Snapshot payload
  snapshot_data JSONB NOT NULL,
  snapshot_type TEXT DEFAULT 'auto', -- 'auto' | 'manual'
  change_description TEXT,
  changed_fields TEXT[],
  diff_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(canvas_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_canvas_versions_canvas_id ON public.canvas_versions(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_versions_created_at ON public.canvas_versions(created_at DESC);

-- Enable RLS
ALTER TABLE public.canvas_versions ENABLE ROW LEVEL SECURITY;

-- Read policy: users can read versions of their own canvases
DROP POLICY IF EXISTS "Users can read versions of own canvases" ON public.canvas_versions;
CREATE POLICY "Users can read versions of own canvases"
  ON public.canvas_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.canvases c
      WHERE c.id = canvas_versions.canvas_id AND c.user_id = auth.uid()
    )
  );

-- Insert policy: users can create versions for their own canvases
DROP POLICY IF EXISTS "Users can insert versions for own canvases" ON public.canvas_versions;
CREATE POLICY "Users can insert versions for own canvases"
  ON public.canvas_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.canvases c
      WHERE c.id = canvas_versions.canvas_id AND c.user_id = auth.uid()
    )
  );

-- Delete policy (optional): allow delete by owners
DROP POLICY IF EXISTS "Users can delete versions of own canvases" ON public.canvas_versions;
CREATE POLICY "Users can delete versions of own canvases"
  ON public.canvas_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.canvases c
      WHERE c.id = canvas_versions.canvas_id AND c.user_id = auth.uid()
    )
  );
