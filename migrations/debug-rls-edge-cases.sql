-- Diagnostic SQL for RLS edge cases
-- Run in a safe environment (non-prod) to validate RLS behavior.

-- Parameters (replace with actual UUIDs/IDs)
-- :user_a, :user_b, :workspace_w, :folder_f, :note_n

-- 1) Visibility by membership
select n.id, n.user_id, n.workspace_id
from notes n
where n.workspace_id = 'your-workspace-id'; -- Replace 'your-workspace-id' with an actual UUID
order by n.created_at desc
limit 20;

-- 2) Member B cannot see workspace W after removal
select n.id
from notes n
where n.workspace_id = 'your-workspace-id'; -- Replace 'your-workspace-id' with an actual UUID
  and n.user_id = :user_b; -- expect 0 rows when executed under user_b role

-- 3) Public share access
select n.id, n.summary
from notes n
where n.is_public = true
  and n.share_id is not null
limit 10;

-- 4) Folder join integrity
select n.id, f.id as folder_id
from notes n
left join folders f on f.id = n.folder_id
where (n.folder_id is null or f.workspace_id = n.workspace_id);

-- 5) Tag linkage respects ownership
select nt.note_id, t.name, t.user_id
from note_tags nt
join tags t on t.id = nt.tag_id
where t.user_id = :user_a
limit 50;

-- 6) Sentiment + workspace filter
select id, sentiment
from notes
where workspace_id = 'your-workspace-id'; -- Replace 'your-workspace-id' with an actual UUID
  and sentiment in ('positive','neutral','negative')
limit 50;

-- 7) Delete constraints (run with caution)
-- delete from workspaces where id = :workspace_w returning *; -- should cascade or be blocked by FK as intended
