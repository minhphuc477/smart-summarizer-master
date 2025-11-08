-- =====================================================
-- PDF Storage Bucket Setup & Test Data
-- Date: 2025-11-08
-- Purpose: Create PDF storage bucket and seed test data
-- =====================================================

-- =====================================================
-- 1. CREATE PDF STORAGE BUCKET
-- =====================================================
-- Note: Storage buckets must be created via Supabase Dashboard > Storage
-- This is a reference SQL for what needs to be created:
-- 
-- Bucket Name: pdf-documents
-- Public: false
-- File size limit: 100MB
-- Allowed MIME types: application/pdf
--
-- RLS Policies needed:
-- 1. Allow authenticated users to upload to their own folder
-- 2. Allow users to read their own files
-- 3. Allow users to delete their own files

-- Create the bucket (if using SQL - normally done via Dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdf-documents',
  'pdf-documents',
  false,
  104857600, -- 100MB in bytes
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Grant storage access to authenticated users
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- =====================================================
-- 2. RLS POLICIES FOR PDF BUCKET
-- =====================================================

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload PDFs to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdf-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own files
CREATE POLICY "Users can read own PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pdf-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdf-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pdf-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- 3. SEED TEST DATA FOR USER: mphuc666@gmail.com
-- User ID: af5616ae-d19b-47fb-93c2-790f9cc40fd0
-- =====================================================

DO $$
DECLARE
  test_user_id UUID := 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';
  workspace1_id UUID;
  workspace2_id UUID;
  folder1_id BIGINT;
  folder2_id BIGINT;
  note1_id BIGINT;
  note2_id BIGINT;
  note3_id BIGINT;
  note4_id BIGINT;
  note5_id BIGINT;
  tag_productivity_id BIGINT;
  tag_meeting_id BIGINT;
  tag_ideas_id BIGINT;
  tag_research_id BIGINT;
BEGIN

  -- =====================================================
  -- CREATE WORKSPACES
  -- =====================================================
  
  -- Workspace 1: Work Projects
  INSERT INTO workspaces (owner_id, name, description, created_at, updated_at)
  VALUES (
    test_user_id,
    'Work Projects',
    'All work-related projects and meetings',
    NOW(),
    NOW()
  )
  RETURNING id INTO workspace1_id;

  -- Workspace 2: Personal Learning
  INSERT INTO workspaces (owner_id, name, description, created_at, updated_at)
  VALUES (
    test_user_id,
    'Personal Learning',
    'Study notes, research, and learning materials',
    NOW(),
    NOW()
  )
  RETURNING id INTO workspace2_id;

  -- =====================================================
  -- CREATE FOLDERS
  -- =====================================================
  
  -- Folder 1: Sprint Planning (in Work Projects)
  INSERT INTO folders (workspace_id, user_id, name, color, created_at, updated_at)
  VALUES (
    workspace1_id,
    test_user_id,
    'Sprint Planning',
    '#3b82f6', -- blue
    NOW(),
    NOW()
  )
  RETURNING id INTO folder1_id;

  -- Folder 2: Tech Research (in Personal Learning)
  INSERT INTO folders (workspace_id, user_id, name, color, created_at, updated_at)
  VALUES (
    workspace2_id,
    test_user_id,
    'Tech Research',
    '#10b981', -- green
    NOW(),
    NOW()
  )
  RETURNING id INTO folder2_id;

  -- =====================================================
  -- CREATE TAGS
  -- =====================================================
  
  INSERT INTO tags (user_id, name)
  VALUES (test_user_id, 'productivity')
  RETURNING id INTO tag_productivity_id;

  INSERT INTO tags (user_id, name)
  VALUES (test_user_id, 'meeting')
  RETURNING id INTO tag_meeting_id;

  INSERT INTO tags (user_id, name)
  VALUES (test_user_id, 'ideas')
  RETURNING id INTO tag_ideas_id;

  INSERT INTO tags (user_id, name)
  VALUES (test_user_id, 'research')
  RETURNING id INTO tag_research_id;

  -- =====================================================
  -- CREATE NOTES WITH SUMMARIES
  -- =====================================================
  
  -- Note 1: Team Meeting Summary
  INSERT INTO notes (
    user_id,
    workspace_id,
    folder_id,
    persona,
    original_notes,
    summary,
    takeaways,
    actions,
    sentiment,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    workspace1_id,
    folder1_id,
    'professional',
    'Discussed Q4 goals, team velocity improvements, and upcoming feature releases. Sarah raised concerns about testing coverage. Mike suggested automation tools. Agreed to implement CI/CD pipeline.',
    'The team meeting covered Q4 objectives with a focus on improving development velocity and feature delivery. Key discussion points included testing coverage gaps and automation opportunities.',
    ARRAY[
      'Team velocity needs improvement for Q4 targets',
      'Current testing coverage is insufficient',
      'CI/CD pipeline will streamline deployment',
      'Automation tools can reduce manual work'
    ],
    ARRAY[
      '{"task": "Research CI/CD tools for the project", "datetime": "2025-11-15T10:00:00Z"}',
      '{"task": "Schedule testing workshop with Sarah", "datetime": "2025-11-12T14:00:00Z"}',
      '{"task": "Draft automation proposal for review", "datetime": "2025-11-20T16:00:00Z"}'
    ]::jsonb[],
    'positive',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  )
  RETURNING id INTO note1_id;

  -- Link tags to note 1
  INSERT INTO note_tags (note_id, tag_id)
  VALUES 
    (note1_id, tag_productivity_id),
    (note1_id, tag_meeting_id);

  -- Note 2: Product Brainstorming
  INSERT INTO notes (
    user_id,
    workspace_id,
    folder_id,
    persona,
    original_notes,
    summary,
    takeaways,
    actions,
    sentiment,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    workspace1_id,
    folder1_id,
    'creative',
    'Brainstormed new feature ideas: AI-powered search, dark mode, collaboration tools, mobile app. Users want better filtering and smart notifications. Consider gamification elements.',
    'Product brainstorming session generated multiple feature ideas focusing on AI integration, UI improvements, and mobile experience. User feedback emphasized smart filtering and notification preferences.',
    ARRAY[
      'AI-powered search is highly requested',
      'Dark mode is a must-have feature',
      'Mobile app would expand user reach',
      'Smart notifications need customization options'
    ],
    ARRAY[
      '{"task": "Create feature specs for AI search", "datetime": "2025-11-18T09:00:00Z"}',
      '{"task": "Design dark mode UI mockups", "datetime": "2025-11-22T11:00:00Z"}',
      '{"task": "Survey users on mobile app interest", "datetime": null}'
    ]::jsonb[],
    'positive',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  )
  RETURNING id INTO note2_id;

  -- Link tags to note 2
  INSERT INTO note_tags (note_id, tag_id)
  VALUES 
    (note2_id, tag_ideas_id),
    (note2_id, tag_productivity_id);

  -- Note 3: Next.js 15 Research
  INSERT INTO notes (
    user_id,
    workspace_id,
    folder_id,
    persona,
    original_notes,
    summary,
    takeaways,
    actions,
    sentiment,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    workspace2_id,
    folder2_id,
    'technical',
    'Next.js 15 introduces React Server Components as default, improved caching strategies, Turbopack for faster builds, and partial prerendering. Need to understand migration path from Next 14.',
    'Next.js 15 brings significant architectural changes including server components by default, enhanced caching mechanisms, Turbopack integration for build performance, and experimental partial prerendering features.',
    ARRAY[
      'React Server Components are now the default paradigm',
      'Turbopack offers significant build speed improvements',
      'Caching strategies have been refined and simplified',
      'Migration from Next 14 requires careful planning'
    ],
    ARRAY[
      '{"task": "Test Turbopack in development environment", "datetime": "2025-11-10T14:00:00Z"}',
      '{"task": "Review migration guide and breaking changes", "datetime": "2025-11-13T10:00:00Z"}',
      '{"task": "Plan phased upgrade strategy", "datetime": null}'
    ]::jsonb[],
    'neutral',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  )
  RETURNING id INTO note3_id;

  -- Link tags to note 3
  INSERT INTO note_tags (note_id, tag_id)
  VALUES 
    (note3_id, tag_research_id);

  -- Note 4: AI Model Comparison
  INSERT INTO notes (
    user_id,
    workspace_id,
    folder_id,
    persona,
    original_notes,
    summary,
    takeaways,
    actions,
    sentiment,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    workspace2_id,
    folder2_id,
    'analytical',
    'Comparing GPT-4, Claude 3.5, and Gemini Pro for our use case. GPT-4 excels at reasoning, Claude has better instruction following, Gemini offers cost advantages. Need to benchmark on real data.',
    'Comparative analysis of leading AI models reveals distinct strengths: GPT-4 for complex reasoning, Claude 3.5 for precise instruction adherence, and Gemini Pro for cost-effective deployment.',
    ARRAY[
      'GPT-4 shows superior performance on reasoning tasks',
      'Claude 3.5 provides more reliable instruction following',
      'Gemini Pro offers best price-performance ratio',
      'Real-world benchmarking is essential for decision'
    ],
    ARRAY[
      '{"task": "Set up benchmark test suite", "datetime": "2025-11-16T09:00:00Z"}',
      '{"task": "Run comparative tests on sample data", "datetime": "2025-11-19T13:00:00Z"}',
      '{"task": "Document findings in tech report", "datetime": "2025-11-25T15:00:00Z"}'
    ]::jsonb[],
    'neutral',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  )
  RETURNING id INTO note4_id;

  -- Link tags to note 4
  INSERT INTO note_tags (note_id, tag_id)
  VALUES 
    (note4_id, tag_research_id);

  -- Note 5: Quick Productivity Tips
  INSERT INTO notes (
    user_id,
    workspace_id,
    folder_id,
    persona,
    original_notes,
    summary,
    takeaways,
    actions,
    sentiment,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    workspace2_id,
    NULL, -- No folder, just in workspace
    'casual',
    'Time blocking really works! Started using Pomodoro technique - 25 min focus, 5 min break. Also keeping a daily done list instead of just to-do. Morning routine sets the tone for whole day.',
    'Productivity improvements through time management techniques: Pomodoro method for focused work sessions, done lists for tracking accomplishments, and consistent morning routines for daily momentum.',
    ARRAY[
      'Time blocking prevents context switching',
      'Pomodoro technique maintains focus and prevents burnout',
      'Done lists provide motivation and progress tracking',
      'Morning routines create consistent productivity patterns'
    ],
    ARRAY[
      '{"task": "Try Pomodoro for one week and track results", "datetime": null}',
      '{"task": "Create morning routine checklist", "datetime": null}'
    ]::jsonb[],
    'positive',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
  )
  RETURNING id INTO note5_id;

  -- Link tags to note 5
  INSERT INTO note_tags (note_id, tag_id)
  VALUES 
    (note5_id, tag_productivity_id),
    (note5_id, tag_ideas_id);

  -- =====================================================
  -- CREATE COMMENTS
  -- =====================================================
  
  -- Comment on Note 1 (Team Meeting)
  INSERT INTO comments (
    note_id,
    user_id,
    content,
    mentions,
    resolved,
    created_at,
    updated_at
  )
  VALUES (
    note1_id,
    test_user_id,
    'Great summary! We should also consider the timeline for the CI/CD implementation. Maybe add that to the action items?',
    ARRAY[]::uuid[],
    false,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  );

  -- Reply to above comment
  INSERT INTO comments (
    note_id,
    user_id,
    parent_id,
    content,
    mentions,
    resolved,
    created_at,
    updated_at
  )
  VALUES (
    note1_id,
    test_user_id,
    (SELECT id FROM comments WHERE note_id = note1_id ORDER BY created_at DESC LIMIT 1),
    'Good point! I''ll add a timeline in the next sprint planning meeting.',
    ARRAY[]::uuid[],
    false,
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
  );

  -- Comment on Note 3 (Next.js Research)
  INSERT INTO comments (
    note_id,
    user_id,
    content,
    mentions,
    resolved,
    created_at,
    updated_at
  )
  VALUES (
    note3_id,
    test_user_id,
    'The Turbopack integration looks promising. Have you tested the dev server speed improvements?',
    ARRAY[]::uuid[],
    false,
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '6 hours'
  );

  -- =====================================================
  -- CREATE SAMPLE CANVAS
  -- =====================================================
  
  -- Canvas 1: Product Roadmap Visualization
  INSERT INTO canvases (user_id, workspace_id, title, description, created_at, updated_at)
  VALUES (
    test_user_id,
    workspace1_id,
    'Q4 Product Roadmap',
    '{"theme": "mind-map", "nodeShape": "rounded", "edgeStyle": "smooth", "edgeAnimated": true}',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  );

  -- Add some nodes to the canvas
  INSERT INTO canvas_nodes (
    canvas_id,
    node_id,
    type,
    position_x,
    position_y,
    content,
    color,
    background_color,
    border_color,
    width,
    height,
    created_at,
    updated_at
  )
  VALUES 
    (
      (SELECT id FROM canvases WHERE user_id = test_user_id ORDER BY created_at DESC LIMIT 1),
      'roadmap-q4',
      'default',
      400,
      100,
      'Q4 2025 Goals',
      '#ffffff',
      '#3b82f6',
      '#2563eb',
      200,
      80,
      NOW() - INTERVAL '4 days',
      NOW() - INTERVAL '4 days'
    ),
    (
      (SELECT id FROM canvases WHERE user_id = test_user_id ORDER BY created_at DESC LIMIT 1),
      'feature-ai-search',
      'default',
      200,
      250,
      'AI Search Feature',
      '#ffffff',
      '#10b981',
      '#059669',
      180,
      70,
      NOW() - INTERVAL '4 days',
      NOW() - INTERVAL '4 days'
    ),
    (
      (SELECT id FROM canvases WHERE user_id = test_user_id ORDER BY created_at DESC LIMIT 1),
      'feature-dark-mode',
      'default',
      600,
      250,
      'Dark Mode UI',
      '#ffffff',
      '#8b5cf6',
      '#7c3aed',
      180,
      70,
      NOW() - INTERVAL '4 days',
      NOW() - INTERVAL '4 days'
    );

  -- Add edges connecting nodes
  INSERT INTO canvas_edges (
    canvas_id,
    edge_id,
    source_node_id,
    target_node_id,
    type,
    label,
    animated,
    color,
    created_at
  )
  VALUES 
    (
      (SELECT id FROM canvases WHERE user_id = test_user_id ORDER BY created_at DESC LIMIT 1),
      'edge-1',
      'roadmap-q4',
      'feature-ai-search',
      'smoothstep',
      'Priority 1',
      true,
      '#10b981',
      NOW() - INTERVAL '4 days'
    ),
    (
      (SELECT id FROM canvases WHERE user_id = test_user_id ORDER BY created_at DESC LIMIT 1),
      'edge-2',
      'roadmap-q4',
      'feature-dark-mode',
      'smoothstep',
      'Priority 2',
      true,
      '#8b5cf6',
      NOW() - INTERVAL '4 days'
    );

  RAISE NOTICE 'Test data created successfully for user: mphuc666@gmail.com';
  RAISE NOTICE 'Workspaces: %, %', workspace1_id, workspace2_id;
  RAISE NOTICE 'Folders: %, %', folder1_id, folder2_id;
  RAISE NOTICE 'Notes: %, %, %, %, %', note1_id, note2_id, note3_id, note4_id, note5_id;

END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check created data
SELECT 'Workspaces Created:' as info, COUNT(*) as count 
FROM workspaces 
WHERE owner_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';

SELECT 'Folders Created:' as info, COUNT(*) as count 
FROM folders 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';

SELECT 'Notes Created:' as info, COUNT(*) as count 
FROM notes 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';

SELECT 'Tags Created:' as info, COUNT(*) as count 
FROM tags 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';

SELECT 'Comments Created:' as info, COUNT(*) as count 
FROM comments 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';

SELECT 'Canvases Created:' as info, COUNT(*) as count 
FROM canvases 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';
