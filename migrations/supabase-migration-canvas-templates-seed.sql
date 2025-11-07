-- Seed data for default canvas templates
-- Run this AFTER supabase-migration-canvas-templates.sql

-- Note: System templates have NULL creator_id since they're not owned by any user

-- 1. Brainstorming Template: Central idea with radiating branches
INSERT INTO canvas_templates (
  id,
  name,
  description,
  category,
  nodes,
  edges,
  viewport,
  thumbnail_url,
  color_scheme,
  creator_id,
  workspace_id,
  is_public,
  is_featured,
  is_system,
  tags,
  use_count
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Brainstorming Board',
  'Central topic with radiating idea branches - perfect for ideation sessions and creative thinking',
  'brainstorming',
  '[
    {
      "id": "central",
      "type": "default",
      "position": {"x": 400, "y": 300},
      "data": {"label": "Main Topic"},
      "style": {
        "backgroundColor": "#8b5cf6",
        "color": "#ffffff",
        "border": "2px solid #7c3aed",
        "borderRadius": "50%",
        "width": "120px",
        "height": "120px",
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "fontWeight": "bold",
        "fontSize": "16px"
      }
    },
    {
      "id": "idea1",
      "type": "default",
      "position": {"x": 200, "y": 100},
      "data": {"label": "Idea 1"},
      "style": {"backgroundColor": "#fef3c7", "border": "2px solid #fbbf24", "borderRadius": "8px", "padding": "10px"}
    },
    {
      "id": "idea2",
      "type": "default",
      "position": {"x": 600, "y": 100},
      "data": {"label": "Idea 2"},
      "style": {"backgroundColor": "#fef3c7", "border": "2px solid #fbbf24", "borderRadius": "8px", "padding": "10px"}
    },
    {
      "id": "idea3",
      "type": "default",
      "position": {"x": 700, "y": 300},
      "data": {"label": "Idea 3"},
      "style": {"backgroundColor": "#fef3c7", "border": "2px solid #fbbf24", "borderRadius": "8px", "padding": "10px"}
    },
    {
      "id": "idea4",
      "type": "default",
      "position": {"x": 600, "y": 500},
      "data": {"label": "Idea 4"},
      "style": {"backgroundColor": "#fef3c7", "border": "2px solid #fbbf24", "borderRadius": "8px", "padding": "10px"}
    },
    {
      "id": "idea5",
      "type": "default",
      "position": {"x": 200, "y": 500},
      "data": {"label": "Idea 5"},
      "style": {"backgroundColor": "#fef3c7", "border": "2px solid #fbbf24", "borderRadius": "8px", "padding": "10px"}
    },
    {
      "id": "idea6",
      "type": "default",
      "position": {"x": 100, "y": 300},
      "data": {"label": "Idea 6"},
      "style": {"backgroundColor": "#fef3c7", "border": "2px solid #fbbf24", "borderRadius": "8px", "padding": "10px"}
    }
  ]'::jsonb,
  '[
    {"id": "e-c-1", "source": "central", "target": "idea1", "animated": false, "style": {"stroke": "#8b5cf6"}},
    {"id": "e-c-2", "source": "central", "target": "idea2", "animated": false, "style": {"stroke": "#8b5cf6"}},
    {"id": "e-c-3", "source": "central", "target": "idea3", "animated": false, "style": {"stroke": "#8b5cf6"}},
    {"id": "e-c-4", "source": "central", "target": "idea4", "animated": false, "style": {"stroke": "#8b5cf6"}},
    {"id": "e-c-5", "source": "central", "target": "idea5", "animated": false, "style": {"stroke": "#8b5cf6"}},
    {"id": "e-c-6", "source": "central", "target": "idea6", "animated": false, "style": {"stroke": "#8b5cf6"}}
  ]'::jsonb,
  '{"x": 0, "y": 0, "zoom": 0.8}'::jsonb,
  NULL,
  'purple',
  NULL,
  NULL,
  true,
  true,
  true,
  ARRAY['brainstorming', 'ideation', 'creative', 'mind-map'],
  0
);

-- 2. Project Planning Template: Phases with tasks
INSERT INTO canvas_templates (
  id,
  name,
  description,
  category,
  nodes,
  edges,
  viewport,
  thumbnail_url,
  color_scheme,
  creator_id,
  workspace_id,
  is_public,
  is_featured,
  is_system,
  tags,
  use_count
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  'Project Planning Board',
  'Structured project phases with tasks and milestones - ideal for project management and sprint planning',
  'planning',
  '[
    {
      "id": "phase1",
      "type": "default",
      "position": {"x": 100, "y": 100},
      "data": {"label": "Phase 1: Planning"},
      "style": {"backgroundColor": "#dbeafe", "border": "2px solid #3b82f6", "borderRadius": "8px", "padding": "15px", "fontWeight": "bold", "minWidth": "200px"}
    },
    {
      "id": "task1-1",
      "type": "default",
      "position": {"x": 120, "y": 200},
      "data": {"label": "✓ Define requirements"},
      "style": {"backgroundColor": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": "4px", "padding": "8px", "fontSize": "12px"}
    },
    {
      "id": "task1-2",
      "type": "default",
      "position": {"x": 120, "y": 260},
      "data": {"label": "✓ Create timeline"},
      "style": {"backgroundColor": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": "4px", "padding": "8px", "fontSize": "12px"}
    },
    {
      "id": "phase2",
      "type": "default",
      "position": {"x": 400, "y": 100},
      "data": {"label": "Phase 2: Development"},
      "style": {"backgroundColor": "#fef3c7", "border": "2px solid #f59e0b", "borderRadius": "8px", "padding": "15px", "fontWeight": "bold", "minWidth": "200px"}
    },
    {
      "id": "task2-1",
      "type": "default",
      "position": {"x": 420, "y": 200},
      "data": {"label": "→ Build features"},
      "style": {"backgroundColor": "#fefce8", "border": "1px solid #eab308", "borderRadius": "4px", "padding": "8px", "fontSize": "12px"}
    },
    {
      "id": "task2-2",
      "type": "default",
      "position": {"x": 420, "y": 260},
      "data": {"label": "→ Write tests"},
      "style": {"backgroundColor": "#fefce8", "border": "1px solid #eab308", "borderRadius": "4px", "padding": "8px", "fontSize": "12px"}
    },
    {
      "id": "phase3",
      "type": "default",
      "position": {"x": 700, "y": 100},
      "data": {"label": "Phase 3: Launch"},
      "style": {"backgroundColor": "#f3e8ff", "border": "2px solid #a855f7", "borderRadius": "8px", "padding": "15px", "fontWeight": "bold", "minWidth": "200px"}
    },
    {
      "id": "task3-1",
      "type": "default",
      "position": {"x": 720, "y": 200},
      "data": {"label": "○ Deploy"},
      "style": {"backgroundColor": "#fafafa", "border": "1px solid #d4d4d4", "borderRadius": "4px", "padding": "8px", "fontSize": "12px"}
    },
    {
      "id": "task3-2",
      "type": "default",
      "position": {"x": 720, "y": 260},
      "data": {"label": "○ Monitor"},
      "style": {"backgroundColor": "#fafafa", "border": "1px solid #d4d4d4", "borderRadius": "4px", "padding": "8px", "fontSize": "12px"}
    }
  ]'::jsonb,
  '[
    {"id": "e-p1-t1", "source": "phase1", "target": "task1-1", "animated": false, "style": {"stroke": "#3b82f6"}},
    {"id": "e-p1-t2", "source": "phase1", "target": "task1-2", "animated": false, "style": {"stroke": "#3b82f6"}},
    {"id": "e-p1-p2", "source": "phase1", "target": "phase2", "animated": true, "style": {"stroke": "#3b82f6", "strokeDasharray": "5 5"}},
    {"id": "e-p2-t1", "source": "phase2", "target": "task2-1", "animated": false, "style": {"stroke": "#f59e0b"}},
    {"id": "e-p2-t2", "source": "phase2", "target": "task2-2", "animated": false, "style": {"stroke": "#f59e0b"}},
    {"id": "e-p2-p3", "source": "phase2", "target": "phase3", "animated": true, "style": {"stroke": "#f59e0b", "strokeDasharray": "5 5"}},
    {"id": "e-p3-t1", "source": "phase3", "target": "task3-1", "animated": false, "style": {"stroke": "#a855f7"}},
    {"id": "e-p3-t2", "source": "phase3", "target": "task3-2", "animated": false, "style": {"stroke": "#a855f7"}}
  ]'::jsonb,
  '{"x": 50, "y": 50, "zoom": 0.9}'::jsonb,
  NULL,
  'blue',
  NULL,
  NULL,
  true,
  true,
  true,
  ARRAY['planning', 'project', 'workflow', 'agile', 'tasks'],
  0
);

-- 3. Mind Map Template: Hierarchical structure
INSERT INTO canvas_templates (
  id,
  name,
  description,
  category,
  nodes,
  edges,
  viewport,
  thumbnail_url,
  color_scheme,
  creator_id,
  workspace_id,
  is_public,
  is_featured,
  is_system,
  tags,
  use_count
) VALUES (
  '10000000-0000-0000-0000-000000000003',
  'Mind Map',
  'Hierarchical knowledge structure with three levels - great for organizing complex information',
  'mind-map',
  '[
    {
      "id": "root",
      "type": "default",
      "position": {"x": 400, "y": 50},
      "data": {"label": "Main Concept"},
      "style": {
        "backgroundColor": "#ef4444",
        "color": "#ffffff",
        "border": "3px solid #dc2626",
        "borderRadius": "12px",
        "padding": "16px",
        "fontWeight": "bold",
        "fontSize": "16px",
        "minWidth": "150px",
        "textAlign": "center"
      }
    },
    {
      "id": "branch1",
      "type": "default",
      "position": {"x": 150, "y": 200},
      "data": {"label": "Branch 1"},
      "style": {"backgroundColor": "#fbbf24", "color": "#000", "border": "2px solid #f59e0b", "borderRadius": "8px", "padding": "12px", "fontWeight": "600"}
    },
    {
      "id": "branch1-1",
      "type": "default",
      "position": {"x": 50, "y": 320},
      "data": {"label": "Detail 1.1"},
      "style": {"backgroundColor": "#fef3c7", "border": "1px solid #fbbf24", "borderRadius": "6px", "padding": "8px", "fontSize": "13px"}
    },
    {
      "id": "branch1-2",
      "type": "default",
      "position": {"x": 200, "y": 320},
      "data": {"label": "Detail 1.2"},
      "style": {"backgroundColor": "#fef3c7", "border": "1px solid #fbbf24", "borderRadius": "6px", "padding": "8px", "fontSize": "13px"}
    },
    {
      "id": "branch2",
      "type": "default",
      "position": {"x": 400, "y": 200},
      "data": {"label": "Branch 2"},
      "style": {"backgroundColor": "#60a5fa", "color": "#fff", "border": "2px solid #3b82f6", "borderRadius": "8px", "padding": "12px", "fontWeight": "600"}
    },
    {
      "id": "branch2-1",
      "type": "default",
      "position": {"x": 350, "y": 320},
      "data": {"label": "Detail 2.1"},
      "style": {"backgroundColor": "#dbeafe", "border": "1px solid #60a5fa", "borderRadius": "6px", "padding": "8px", "fontSize": "13px"}
    },
    {
      "id": "branch2-2",
      "type": "default",
      "position": {"x": 500, "y": 320},
      "data": {"label": "Detail 2.2"},
      "style": {"backgroundColor": "#dbeafe", "border": "1px solid #60a5fa", "borderRadius": "6px", "padding": "8px", "fontSize": "13px"}
    },
    {
      "id": "branch3",
      "type": "default",
      "position": {"x": 650, "y": 200},
      "data": {"label": "Branch 3"},
      "style": {"backgroundColor": "#34d399", "color": "#000", "border": "2px solid #10b981", "borderRadius": "8px", "padding": "12px", "fontWeight": "600"}
    },
    {
      "id": "branch3-1",
      "type": "default",
      "position": {"x": 600, "y": 320},
      "data": {"label": "Detail 3.1"},
      "style": {"backgroundColor": "#d1fae5", "border": "1px solid #34d399", "borderRadius": "6px", "padding": "8px", "fontSize": "13px"}
    },
    {
      "id": "branch3-2",
      "type": "default",
      "position": {"x": 750, "y": 320},
      "data": {"label": "Detail 3.2"},
      "style": {"backgroundColor": "#d1fae5", "border": "1px solid #34d399", "borderRadius": "6px", "padding": "8px", "fontSize": "13px"}
    }
  ]'::jsonb,
  '[
    {"id": "e-r-b1", "source": "root", "target": "branch1", "animated": false, "style": {"stroke": "#fbbf24", "strokeWidth": 3}, "type": "smoothstep"},
    {"id": "e-r-b2", "source": "root", "target": "branch2", "animated": false, "style": {"stroke": "#60a5fa", "strokeWidth": 3}, "type": "smoothstep"},
    {"id": "e-r-b3", "source": "root", "target": "branch3", "animated": false, "style": {"stroke": "#34d399", "strokeWidth": 3}, "type": "smoothstep"},
    {"id": "e-b1-d1", "source": "branch1", "target": "branch1-1", "animated": false, "style": {"stroke": "#fbbf24", "strokeWidth": 2}},
    {"id": "e-b1-d2", "source": "branch1", "target": "branch1-2", "animated": false, "style": {"stroke": "#fbbf24", "strokeWidth": 2}},
    {"id": "e-b2-d1", "source": "branch2", "target": "branch2-1", "animated": false, "style": {"stroke": "#60a5fa", "strokeWidth": 2}},
    {"id": "e-b2-d2", "source": "branch2", "target": "branch2-2", "animated": false, "style": {"stroke": "#60a5fa", "strokeWidth": 2}},
    {"id": "e-b3-d1", "source": "branch3", "target": "branch3-1", "animated": false, "style": {"stroke": "#34d399", "strokeWidth": 2}},
    {"id": "e-b3-d2", "source": "branch3", "target": "branch3-2", "animated": false, "style": {"stroke": "#34d399", "strokeWidth": 2}}
  ]'::jsonb,
  '{"x": 0, "y": 0, "zoom": 0.85}'::jsonb,
  NULL,
  'colorful',
  NULL,
  NULL,
  true,
  true,
  true,
  ARRAY['mind-map', 'hierarchy', 'knowledge', 'structure', 'learning'],
  0
);

-- 4. Decision Matrix Template: Pros/Cons grid
INSERT INTO canvas_templates (
  id,
  name,
  description,
  category,
  nodes,
  edges,
  viewport,
  thumbnail_url,
  color_scheme,
  creator_id,
  workspace_id,
  is_public,
  is_featured,
  is_system,
  tags,
  use_count
) VALUES (
  '10000000-0000-0000-0000-000000000004',
  'Decision Matrix',
  'Pros and cons comparison grid - perfect for making informed decisions and evaluating options',
  'planning',
  '[
    {
      "id": "decision",
      "type": "default",
      "position": {"x": 350, "y": 50},
      "data": {"label": "Decision: [Your Choice]"},
      "style": {
        "backgroundColor": "#6366f1",
        "color": "#ffffff",
        "border": "3px solid #4f46e5",
        "borderRadius": "12px",
        "padding": "20px",
        "fontWeight": "bold",
        "fontSize": "18px",
        "minWidth": "300px",
        "textAlign": "center"
      }
    },
    {
      "id": "pros-header",
      "type": "default",
      "position": {"x": 200, "y": 180},
      "data": {"label": "✓ PROS"},
      "style": {
        "backgroundColor": "#22c55e",
        "color": "#ffffff",
        "border": "2px solid #16a34a",
        "borderRadius": "8px",
        "padding": "12px",
        "fontWeight": "bold",
        "fontSize": "16px",
        "minWidth": "200px",
        "textAlign": "center"
      }
    },
    {
      "id": "pro1",
      "type": "default",
      "position": {"x": 210, "y": 260},
      "data": {"label": "Advantage 1"},
      "style": {"backgroundColor": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": "6px", "padding": "10px"}
    },
    {
      "id": "pro2",
      "type": "default",
      "position": {"x": 210, "y": 330},
      "data": {"label": "Advantage 2"},
      "style": {"backgroundColor": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": "6px", "padding": "10px"}
    },
    {
      "id": "pro3",
      "type": "default",
      "position": {"x": 210, "y": 400},
      "data": {"label": "Advantage 3"},
      "style": {"backgroundColor": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": "6px", "padding": "10px"}
    },
    {
      "id": "cons-header",
      "type": "default",
      "position": {"x": 500, "y": 180},
      "data": {"label": "✗ CONS"},
      "style": {
        "backgroundColor": "#ef4444",
        "color": "#ffffff",
        "border": "2px solid #dc2626",
        "borderRadius": "8px",
        "padding": "12px",
        "fontWeight": "bold",
        "fontSize": "16px",
        "minWidth": "200px",
        "textAlign": "center"
      }
    },
    {
      "id": "con1",
      "type": "default",
      "position": {"x": 510, "y": 260},
      "data": {"label": "Disadvantage 1"},
      "style": {"backgroundColor": "#fee2e2", "border": "1px solid #ef4444", "borderRadius": "6px", "padding": "10px"}
    },
    {
      "id": "con2",
      "type": "default",
      "position": {"x": 510, "y": 330},
      "data": {"label": "Disadvantage 2"},
      "style": {"backgroundColor": "#fee2e2", "border": "1px solid #ef4444", "borderRadius": "6px", "padding": "10px"}
    },
    {
      "id": "con3",
      "type": "default",
      "position": {"x": 510, "y": 400},
      "data": {"label": "Disadvantage 3"},
      "style": {"backgroundColor": "#fee2e2", "border": "1px solid #ef4444", "borderRadius": "6px", "padding": "10px"}
    }
  ]'::jsonb,
  '[
    {"id": "e-d-pros", "source": "decision", "target": "pros-header", "animated": false, "style": {"stroke": "#22c55e", "strokeWidth": 2}},
    {"id": "e-d-cons", "source": "decision", "target": "cons-header", "animated": false, "style": {"stroke": "#ef4444", "strokeWidth": 2}},
    {"id": "e-ph-p1", "source": "pros-header", "target": "pro1", "animated": false, "style": {"stroke": "#22c55e"}},
    {"id": "e-ph-p2", "source": "pros-header", "target": "pro2", "animated": false, "style": {"stroke": "#22c55e"}},
    {"id": "e-ph-p3", "source": "pros-header", "target": "pro3", "animated": false, "style": {"stroke": "#22c55e"}},
    {"id": "e-ch-c1", "source": "cons-header", "target": "con1", "animated": false, "style": {"stroke": "#ef4444"}},
    {"id": "e-ch-c2", "source": "cons-header", "target": "con2", "animated": false, "style": {"stroke": "#ef4444"}},
    {"id": "e-ch-c3", "source": "cons-header", "target": "con3", "animated": false, "style": {"stroke": "#ef4444"}}
  ]'::jsonb,
  '{"x": 50, "y": 0, "zoom": 0.9}'::jsonb,
  NULL,
  'green-red',
  NULL,
  NULL,
  true,
  true,
  true,
  ARRAY['decision', 'pros-cons', 'planning', 'analysis', 'comparison'],
  0
);

-- 5. Workflow Diagram Template: Process flow with decision points
INSERT INTO canvas_templates (
  id,
  name,
  description,
  category,
  nodes,
  edges,
  viewport,
  thumbnail_url,
  color_scheme,
  creator_id,
  workspace_id,
  is_public,
  is_featured,
  is_system,
  tags,
  use_count
) VALUES (
  '10000000-0000-0000-0000-000000000005',
  'Workflow Diagram',
  'Process flow with decision points and multiple paths - ideal for documenting business processes',
  'workflow',
  '[
    {
      "id": "start",
      "type": "default",
      "position": {"x": 400, "y": 50},
      "data": {"label": "START"},
      "style": {
        "backgroundColor": "#10b981",
        "color": "#ffffff",
        "border": "3px solid #059669",
        "borderRadius": "50%",
        "width": "100px",
        "height": "100px",
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "fontWeight": "bold"
      }
    },
    {
      "id": "step1",
      "type": "default",
      "position": {"x": 375, "y": 200},
      "data": {"label": "Step 1: Input"},
      "style": {"backgroundColor": "#dbeafe", "border": "2px solid #3b82f6", "borderRadius": "8px", "padding": "16px", "minWidth": "150px"}
    },
    {
      "id": "decision1",
      "type": "default",
      "position": {"x": 360, "y": 320},
      "data": {"label": "Decision?"},
      "style": {
        "backgroundColor": "#fef3c7",
        "border": "3px solid #f59e0b",
        "transform": "rotate(45deg)",
        "width": "120px",
        "height": "120px",
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "fontWeight": "bold"
      }
    },
    {
      "id": "step2a",
      "type": "default",
      "position": {"x": 200, "y": 480},
      "data": {"label": "Path A: Process"},
      "style": {"backgroundColor": "#d1fae5", "border": "2px solid #10b981", "borderRadius": "8px", "padding": "16px", "minWidth": "150px"}
    },
    {
      "id": "step2b",
      "type": "default",
      "position": {"x": 550, "y": 480},
      "data": {"label": "Path B: Alternative"},
      "style": {"backgroundColor": "#fce7f3", "border": "2px solid #ec4899", "borderRadius": "8px", "padding": "16px", "minWidth": "150px"}
    },
    {
      "id": "merge",
      "type": "default",
      "position": {"x": 375, "y": 620},
      "data": {"label": "Merge Results"},
      "style": {"backgroundColor": "#e0e7ff", "border": "2px solid #6366f1", "borderRadius": "8px", "padding": "16px", "minWidth": "150px"}
    },
    {
      "id": "end",
      "type": "default",
      "position": {"x": 400, "y": 750},
      "data": {"label": "END"},
      "style": {
        "backgroundColor": "#ef4444",
        "color": "#ffffff",
        "border": "3px solid #dc2626",
        "borderRadius": "50%",
        "width": "100px",
        "height": "100px",
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "fontWeight": "bold"
      }
    }
  ]'::jsonb,
  '[
    {"id": "e-start-s1", "source": "start", "target": "step1", "animated": true, "style": {"stroke": "#10b981", "strokeWidth": 2}},
    {"id": "e-s1-d1", "source": "step1", "target": "decision1", "animated": true, "style": {"stroke": "#3b82f6", "strokeWidth": 2}},
    {"id": "e-d1-s2a", "source": "decision1", "target": "step2a", "animated": false, "label": "Yes", "style": {"stroke": "#10b981", "strokeWidth": 2}},
    {"id": "e-d1-s2b", "source": "decision1", "target": "step2b", "animated": false, "label": "No", "style": {"stroke": "#ec4899", "strokeWidth": 2}},
    {"id": "e-s2a-m", "source": "step2a", "target": "merge", "animated": true, "style": {"stroke": "#10b981", "strokeWidth": 2}},
    {"id": "e-s2b-m", "source": "step2b", "target": "merge", "animated": true, "style": {"stroke": "#ec4899", "strokeWidth": 2}},
    {"id": "e-m-end", "source": "merge", "target": "end", "animated": true, "style": {"stroke": "#6366f1", "strokeWidth": 2}}
  ]'::jsonb,
  '{"x": 100, "y": 0, "zoom": 0.8}'::jsonb,
  NULL,
  'flow',
  NULL,
  NULL,
  true,
  true,
  true,
  ARRAY['workflow', 'process', 'flowchart', 'diagram', 'business'],
  0
);

-- Verify templates were inserted
SELECT 
  name, 
  category, 
  is_featured, 
  is_system,
  array_length(tags, 1) as tag_count,
  jsonb_array_length(nodes) as node_count,
  jsonb_array_length(edges) as edge_count
FROM canvas_templates
WHERE is_system = true
ORDER BY created_at;
