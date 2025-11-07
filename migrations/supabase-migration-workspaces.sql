-- =====================================================
-- MIGRATION: Workspaces & Collaboration Features
-- =====================================================
-- Tạo bảng workspaces và workspace_members
-- Thêm cột workspace_id vào notes và folders
-- Thêm share_id và is_public vào notes
-- Cập nhật RLS policies cho collaboration
-- =====================================================

-- 1. Tạo bảng WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT workspaces_name_check CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Index cho performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON public.workspaces(created_at DESC);

-- 2. Tạo bảng WORKSPACE_MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint để không duplicate members
  CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id),
  -- Constraint cho role values
  CONSTRAINT workspace_members_role_check CHECK (role IN ('owner', 'admin', 'member'))
);

-- Index cho performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

-- 3. Thêm cột WORKSPACE_ID vào NOTES
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Thêm cột SHARE_ID và IS_PUBLIC cho public sharing
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS share_id UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Index cho performance
CREATE INDEX IF NOT EXISTS idx_notes_workspace_id ON public.notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notes_share_id ON public.notes(share_id) WHERE is_public = TRUE;

-- 4. Thêm cột WORKSPACE_ID vào FOLDERS
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Index cho performance
CREATE INDEX IF NOT EXISTS idx_folders_workspace_id ON public.folders(workspace_id);

-- =====================================================
-- TRIGGER: Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER: Auto-add owner as workspace member
-- =====================================================
CREATE OR REPLACE FUNCTION add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_add_owner_member
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_as_member();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- WORKSPACES POLICIES
-- =====================================================

-- Policy: User có thể xem workspace nếu là member
CREATE POLICY "Users can view workspaces they are members of"
  ON public.workspaces FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = id
    )
  );

-- Policy: User có thể tạo workspace
CREATE POLICY "Users can create their own workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Owner và admin có thể update workspace
CREATE POLICY "Owners and admins can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = id AND role IN ('owner', 'admin')
    )
  );

-- Policy: Chỉ owner mới có thể delete workspace
CREATE POLICY "Only owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- =====================================================
-- WORKSPACE_MEMBERS POLICIES
-- =====================================================

-- Policy: User có thể xem members của workspace họ tham gia
CREATE POLICY "Users can view members of their workspaces"
  ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Owner và admin có thể thêm members
CREATE POLICY "Owners and admins can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Policy: Owner và admin có thể xóa members (trừ owner)
CREATE POLICY "Owners and admins can remove members"
  ON public.workspace_members FOR DELETE
  USING (
    role != 'owner' AND
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Policy: User có thể rời khỏi workspace (self-remove)
CREATE POLICY "Users can leave workspaces"
  ON public.workspace_members FOR DELETE
  USING (
    user_id = auth.uid() AND role != 'owner'
  );

-- =====================================================
-- CẬP NHẬT RLS POLICIES CHO NOTES
-- =====================================================

-- Drop existing policies (sẽ recreate với logic mới)
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;

-- Policy: User có thể xem note nếu:
-- 1. Họ là owner của note, HOẶC
-- 2. Note thuộc workspace mà họ là member, HOẶC
-- 3. Note được public share (is_public = true)
CREATE POLICY "Users can view their notes or workspace notes or public notes"
  ON public.notes FOR SELECT
  USING (
    user_id = auth.uid() 
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
    OR is_public = TRUE
  );

-- Policy: User có thể tạo note trong workspace nếu là member
CREATE POLICY "Users can create notes in their workspaces"
  ON public.notes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      workspace_id IS NULL 
      OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: User có thể update note nếu là owner
CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: User có thể delete note nếu là owner
CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CẬP NHẬT RLS POLICIES CHO FOLDERS
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;

-- Policy: User có thể xem folder nếu:
-- 1. Họ là owner của folder, HOẶC
-- 2. Folder thuộc workspace mà họ là member
CREATE POLICY "Users can view their folders or workspace folders"
  ON public.folders FOR SELECT
  USING (
    user_id = auth.uid() 
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: User có thể tạo folder trong workspace nếu là member
CREATE POLICY "Users can create folders in their workspaces"
  ON public.folders FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      workspace_id IS NULL 
      OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: User có thể update folder nếu là owner
CREATE POLICY "Users can update their own folders"
  ON public.folders FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: User có thể delete folder nếu là owner
CREATE POLICY "Users can delete their own folders"
  ON public.folders FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- VIEWS: Helper views for frontend
-- =====================================================

-- View: Workspace stats
CREATE OR REPLACE VIEW workspace_stats AS
SELECT 
  w.id AS workspace_id,
  w.name AS workspace_name,
  w.owner_id,
  COUNT(DISTINCT wm.user_id) AS member_count,
  COUNT(DISTINCT n.id) AS note_count,
  COUNT(DISTINCT f.id) AS folder_count,
  w.created_at,
  w.updated_at
FROM public.workspaces w
LEFT JOIN public.workspace_members wm ON w.id = wm.workspace_id
LEFT JOIN public.notes n ON w.id = n.workspace_id
LEFT JOIN public.folders f ON w.id = f.workspace_id
GROUP BY w.id, w.name, w.owner_id, w.created_at, w.updated_at;

-- View: User's workspaces
CREATE OR REPLACE VIEW user_workspaces AS
SELECT 
  wm.user_id,
  w.*,
  wm.role,
  wm.joined_at,
  ws.member_count,
  ws.note_count,
  ws.folder_count
FROM public.workspace_members wm
JOIN public.workspaces w ON wm.workspace_id = w.id
LEFT JOIN workspace_stats ws ON w.id = ws.workspace_id;

-- =====================================================
-- FUNCTIONS: Helper functions
-- =====================================================

-- Function: Check if user is workspace member
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user role in workspace
CREATE OR REPLACE FUNCTION get_workspace_role(workspace_uuid UUID, user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Invite user to workspace by email
CREATE OR REPLACE FUNCTION invite_to_workspace(
  workspace_uuid UUID,
  invitee_email TEXT,
  inviter_uuid UUID DEFAULT auth.uid()
)
RETURNS JSON AS $$
DECLARE
  invitee_uuid UUID;
  inviter_role TEXT;
  result JSON;
BEGIN
  -- Check if inviter has permission (owner or admin)
  SELECT role INTO inviter_role
  FROM public.workspace_members
  WHERE workspace_id = workspace_uuid AND user_id = inviter_uuid;
  
  IF inviter_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', FALSE, 'error', 'Permission denied');
  END IF;
  
  -- Find user by email
  SELECT id INTO invitee_uuid
  FROM auth.users
  WHERE email = invitee_email;
  
  IF invitee_uuid IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;
  
  -- Check if already a member
  IF is_workspace_member(workspace_uuid, invitee_uuid) THEN
    RETURN json_build_object('success', FALSE, 'error', 'User already a member');
  END IF;
  
  -- Add as member
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (workspace_uuid, invitee_uuid, 'member', inviter_uuid);
  
  RETURN json_build_object('success', TRUE, 'user_id', invitee_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment below to insert sample data
/*
-- Insert sample workspace (replace with actual user_id)
INSERT INTO public.workspaces (name, description, owner_id)
VALUES 
  ('Team Alpha', 'Main team workspace', 'YOUR_USER_ID_HERE'),
  ('Project Beta', 'Beta project collaboration', 'YOUR_USER_ID_HERE');
*/

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT SELECT ON workspace_stats TO authenticated;
GRANT SELECT ON user_workspaces TO authenticated;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

-- Verification queries (run after migration):
/*
-- 1. Check workspaces table
SELECT * FROM public.workspaces LIMIT 5;

-- 2. Check workspace_members table
SELECT * FROM public.workspace_members LIMIT 5;

-- 3. Check notes with workspace_id
SELECT id, user_id, workspace_id, is_public, share_id 
FROM public.notes LIMIT 5;

-- 4. Check workspace stats
SELECT * FROM workspace_stats;

-- 5. Test invite function
SELECT invite_to_workspace(
  'workspace-uuid-here',
  'user@example.com'
);
*/
