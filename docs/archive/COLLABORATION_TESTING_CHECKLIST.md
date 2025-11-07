# Collaboration Features Testing Checklist

## Prerequisites ✅
- [ ] SQL migration applied (`supabase-migration-realtime-collaboration.sql`)
- [ ] Realtime enabled in Supabase Dashboard for tables:
  - [ ] `comments`
  - [ ] `presence`
  - [ ] `note_versions`
  - [ ] `comment_notifications`
- [ ] Dev server running (`npm run dev`)
- [ ] At least 2 test user accounts created

## Automated Tests

### Unit Tests (48 tests)
Run: `npm test -- --testPathPattern=collaboration`

- [x] RealtimeCollaboration class (15 tests)
- [x] CommentThread component (11 tests)
- [x] PresenceIndicator component (11 tests)
- [x] VersionHistory component (11 tests)

### E2E Tests (7 tests)
Run: `npm run test:e2e -- collaboration`

- [ ] Show View Details button
- [ ] Open Note Details dialog
- [ ] Show Comments tab by default
- [ ] Allow adding a comment
- [ ] Show Presence tab
- [ ] Show Version History tab
- [ ] Close Note Details dialog

### Realtime Connection Test
Run: `npm run test:realtime`

- [ ] Database connection successful
- [ ] All collaboration tables exist
- [ ] Realtime connection established
- [ ] Realtime enabled on tables
- [ ] RLS policies configured

## Manual Testing

### 1. Single User Testing

#### View Details Button
- [ ] Button appears on all note cards
- [ ] Button has MessageSquare icon (📨)
- [ ] Button opens dialog when clicked
- [ ] Dialog shows note title
- [ ] Dialog has 3 tabs: Comments, Presence, History

#### Comments Tab
- [ ] Tab is selected by default
- [ ] Shows "Add a comment" textarea
- [ ] Post button is disabled when textarea is empty
- [ ] Post button enables when text is entered
- [ ] Can add a comment
- [ ] Comment appears in the list
- [ ] Shows comment author and timestamp
- [ ] Shows relative time (e.g., "5 minutes ago")

#### Threaded Replies
- [ ] Reply button appears on each comment
- [ ] Click Reply shows reply textarea
- [ ] Reply textarea has placeholder "Reply to [username]"
- [ ] Can add a reply
- [ ] Reply appears indented under parent comment
- [ ] Cancel button hides reply textarea

#### @Mentions
- [ ] Can type @username in comment
- [ ] Username is extracted and saved in mentions array
- [ ] Multiple @mentions work

#### Resolve Comments
- [ ] Resolve button appears on top-level comments
- [ ] Only comment author sees Resolve button
- [ ] Click Resolve marks comment as resolved
- [ ] Resolved badge appears
- [ ] Resolved comments stay visible

#### Presence Tab
- [ ] Tab can be selected
- [ ] Shows "No one else is viewing this note" when alone
- [ ] Shows user avatars when others present
- [ ] Shows user count (e.g., "3 users online")

#### Version History Tab
- [ ] Tab can be selected
- [ ] Shows "No version history available" if no versions
- [ ] Shows timeline of versions when available
- [ ] Each version shows version number
- [ ] Each version shows author and timestamp
- [ ] Current version is highlighted
- [ ] Can expand version to see details

#### Version Details
- [ ] Expanded version shows summary
- [ ] Shows takeaways list
- [ ] Shows tags
- [ ] Shows sentiment
- [ ] Shows change statistics

#### Restore Version
- [ ] Restore button appears on non-current versions
- [ ] Click Restore shows confirmation dialog
- [ ] Confirmation shows warning message
- [ ] Cancel closes dialog without changes
- [ ] Confirm restores the version
- [ ] Success toast appears
- [ ] Dialog closes after restore
- [ ] Note is updated with restored content

### 2. Multi-User Testing (Requires 2+ Users)

#### Setup
- [ ] Open app in 2 browser windows/tabs
- [ ] Sign in as User A in window 1
- [ ] Sign in as User B in window 2
- [ ] Both users navigate to the same note
- [ ] Both users click "View Details"

#### Real-Time Comments
- [ ] User A adds a comment
- [ ] Comment appears for User B (within 1-2 seconds)
- [ ] User B adds a reply
- [ ] Reply appears for User A in real-time
- [ ] Comment metadata (author, time) is correct

#### Live Presence
- [ ] User A goes to Presence tab
- [ ] User B's avatar appears in User A's presence list
- [ ] Status indicator shows correct color
- [ ] User count shows "2 users online"
- [ ] User B closes dialog
- [ ] User B's avatar disappears from User A's list (after 5 min timeout)

#### Version History Sync
- [ ] User A edits the note (outside dialog)
- [ ] Version is created automatically
- [ ] User B refreshes version history
- [ ] New version appears in User B's timeline
- [ ] Version shows User A as author

#### Concurrent Editing
- [ ] User A types in Comments tab
- [ ] User B types in Comments tab simultaneously
- [ ] Both comments post successfully
- [ ] No conflicts or data loss
- [ ] Comments appear in correct order (by timestamp)

### 3. Edge Cases & Error Handling

#### Network Issues
- [ ] Disconnect internet
- [ ] Try to add comment
- [ ] Error toast appears
- [ ] Reconnect internet
- [ ] Try again - comment posts successfully

#### Permission Errors
- [ ] User without note access tries to comment
- [ ] Appropriate error message shown
- [ ] User cannot see presence of note they don't own

#### Large Data
- [ ] Add 50+ comments
- [ ] Scroll works smoothly
- [ ] Performance remains good
- [ ] Add 20+ versions
- [ ] Version timeline renders correctly

#### Concurrent Updates
- [ ] Two users add comments at exact same time
- [ ] Both comments appear
- [ ] Timestamps are unique
- [ ] No duplicate IDs

### 4. Mobile & Responsive Testing

#### Mobile View
- [ ] Dialog is responsive on mobile
- [ ] Tabs are accessible
- [ ] Comment textarea works on touch
- [ ] Buttons are tappable
- [ ] Presence avatars stack properly
- [ ] Version timeline scrolls smoothly

#### Tablet View
- [ ] Dialog size appropriate
- [ ] All features accessible
- [ ] Layout doesn't break

## Performance Testing

### Load Time
- [ ] Dialog opens in < 500ms
- [ ] Comments load in < 1s
- [ ] Presence updates in < 2s
- [ ] Version history loads in < 1s

### Real-Time Latency
- [ ] Comment sync delay < 2s
- [ ] Presence update delay < 3s
- [ ] No UI freezing during updates

### Memory & Resources
- [ ] No memory leaks after 10 minutes
- [ ] CPU usage remains normal
- [ ] Network traffic reasonable

## Security Testing

### Authentication
- [ ] Unauthenticated users cannot add comments
- [ ] Cannot access other users' private notes
- [ ] RLS policies enforce access control

### Data Validation
- [ ] Empty comments rejected
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] Invalid version IDs rejected

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Accessibility

- [ ] Keyboard navigation works
- [ ] Tab key moves through fields
- [ ] Enter submits comments
- [ ] Escape closes dialog
- [ ] Screen reader compatible
- [ ] Focus indicators visible
- [ ] Color contrast sufficient

## Known Issues / Limitations

- Multi-user cursor positions not implemented yet
- Presence timeout is 5 minutes (configurable)
- Version history shows all versions (no pagination yet)
- @mentions don't trigger notifications yet (table exists, logic pending)

## Success Criteria

✅ **PASS** if:
- All automated tests pass
- Comments sync in real-time (<2s)
- Presence shows active users
- Version history displays correctly
- No console errors
- Works on mobile

❌ **FAIL** if:
- Comments don't sync
- Realtime connection fails
- Data loss occurs
- Critical console errors
- UI breaks on mobile

## Reporting Issues

If any tests fail, collect:
1. Browser console logs
2. Network tab (WebSocket connections)
3. Supabase Dashboard logs
4. Screenshots/videos
5. Steps to reproduce

Report in: GitHub Issues with label `collaboration`
