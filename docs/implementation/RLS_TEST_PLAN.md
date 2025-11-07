# RLS Test Plan

Scenarios to validate Row Level Security policies across workspaces, folders, notes, and sharing.

## 1. Membership Revocation
- Setup: User A owner, User B member in workspace W. Note N belongs to W.
- Steps:
  1. B queries note N (expect access OK).
  2. Remove B from workspace_members.
  3. B queries note N again (expect NOT FOUND / empty result).
- SQL Checks:
```sql
-- Before revocation
select id from notes where workspace_id = :W and user_id in (:A,:B);
-- After revocation
select id from notes where workspace_id = :W and user_id = :B; -- expect 0 rows
```

## 2. Guest Isolation
- Guest session should never see non-public notes.
- Steps: Guest attempts select on notes (should return only is_public=true rows, or blocked entirely depending policy).
```sql
select id,is_public from notes where is_public = true; -- ensure no non-public returned
```

## 3. Owner vs Member Permissions
- Owner can delete any note in workspace.
- Member can delete only their own notes.
- Attempt delete from member for another user's note should fail.
```sql
delete from notes where id=:other_users_note_id and user_id!=:member_id; -- expect 0 rows affected
```

## 4. Public Share via share_id
- Public note with share_id should be retrievable without auth.
```sql
select id, summary from notes where share_id = :share_id and is_public = true; -- expect 1 row
```

## 5. Folder Scoped Access
- Member with access to workspace sees only notes within folders of that workspace.
```sql
select n.id from notes n join folders f on n.folder_id = f.id where f.workspace_id = :W and n.user_id = :member_id; -- should return rows
```

## 6. Cascading Deletes
- Deleting workspace removes folders and notes (if cascade configured) or RLS prevents orphan access.
```sql
-- After deleting workspace W
select * from folders where workspace_id = :W; -- expect 0 rows
select * from notes where workspace_id = :W; -- expect 0 rows
```

## 7. Cross-Workspace Leakage Prevention
- User B (member of W2) should not see notes in W1.
```sql
select id from notes where workspace_id = :W1 and user_id = :B; -- expect 0
```

## 8. Tag Linking Integrity
- Ensure note_tags join respects user ownership.
```sql
select nt.note_id, t.name from note_tags nt join tags t on nt.tag_id=t.id where t.user_id=:A; -- only A's tags
```

## 9. Sentiment Filter RLS Interaction
- Query notes with sentiment='negative' still restricted by user/workspace policies.
```sql
select id from notes where sentiment='negative' and user_id=:B and workspace_id=:W; -- returns only B's within W
```

## 10. Revoked Member Residual Data
- After revocation, B's old notes remain but inaccessible to B (unless ownership retained model states otherwise).
```sql
select id,user_id from notes where user_id=:B and workspace_id=:W; -- owner can see, B cannot
```

## Automation Outline
1. Setup fixtures via SQL inserts.
2. Use PostgREST (Supabase) with service role for setup, regular anon key for user queries.
3. Parameterize :A, :B, :W, etc.
4. Record row counts and permission errors.

## Edge Cases
- Notes without folder_id but with workspace_id.
- share_id present but is_public=false (should not be accessible).
- Tag duplication between users.

## Success Criteria
- Each forbidden access returns 0 rows or error per policy.
- No cross-workspace leakage.
- Public shares accessible without authentication only when is_public=true.
