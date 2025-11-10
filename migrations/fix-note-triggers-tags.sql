-- Fix note triggers that reference non-existent 'tags' column
-- The notes table doesn't have a tags column; tags are stored in note_tags table

-- Fix the create_note_version function
CREATE OR REPLACE FUNCTION create_note_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM note_versions
  WHERE note_id = OLD.id;
  
  -- Create version snapshot (removed tags reference)
  INSERT INTO note_versions (
    note_id,
    user_id,
    version_number,
    original_notes,
    summary,
    takeaways,
    actions,
    sentiment,
    change_description
  ) VALUES (
    OLD.id,
    OLD.user_id,
    next_version,
    OLD.original_notes,
    OLD.summary,
    OLD.takeaways,
    OLD.actions,
    OLD.sentiment,
    'Auto-saved version'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the create_auto_version_snapshot function
CREATE OR REPLACE FUNCTION create_auto_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields TEXT[];
  v_version_number INTEGER;
  v_should_snapshot BOOLEAN := FALSE;
BEGIN
  -- Check if important fields have changed
  IF OLD.original_notes IS DISTINCT FROM NEW.original_notes THEN
    v_changed_fields := array_append(v_changed_fields, 'original_notes');
    v_should_snapshot := TRUE;
  END IF;
  
  IF OLD.summary IS DISTINCT FROM NEW.summary THEN
    v_changed_fields := array_append(v_changed_fields, 'summary');
    v_should_snapshot := TRUE;
  END IF;
  
  -- For JSONB columns, use proper comparison
  IF (OLD.takeaways::text) IS DISTINCT FROM (NEW.takeaways::text) THEN
    v_changed_fields := array_append(v_changed_fields, 'takeaways');
    v_should_snapshot := TRUE;
  END IF;
  
  IF (OLD.actions::text) IS DISTINCT FROM (NEW.actions::text) THEN
    v_changed_fields := array_append(v_changed_fields, 'actions');
    v_should_snapshot := TRUE;
  END IF;
  
  -- Removed tags check as it doesn't exist in notes table
  
  IF OLD.sentiment IS DISTINCT FROM NEW.sentiment THEN
    v_changed_fields := array_append(v_changed_fields, 'sentiment');
  END IF;
  
  -- Create version snapshot if important fields changed
  IF v_should_snapshot THEN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version_number
    FROM note_versions
    WHERE note_id = NEW.id;
    
    -- Create version (removed tags column)
    INSERT INTO note_versions (
      note_id,
      user_id,
      version_number,
      original_notes,
      summary,
      takeaways,
      actions,
      sentiment,
      changed_fields,
      snapshot_type
    ) VALUES (
      NEW.id,
      NEW.user_id,
      v_version_number,
      NEW.original_notes,
      NEW.summary,
      NEW.takeaways,
      NEW.actions,
      NEW.sentiment,
      v_changed_fields,
      'auto'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the note_versions table structure
-- If tags column doesn't exist in note_versions, we're good
-- If it does exist, we can keep it for historical data but don't populate it from notes table
