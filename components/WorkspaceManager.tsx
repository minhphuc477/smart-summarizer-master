"use client";

import { useState, useEffect, useMemo } from 'react';
import useAsyncAction from '@/lib/useAsyncAction';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Settings, Trash2, UserPlus, Crown, Shield, User, Mail, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  role: 'owner' | 'admin' | 'member';
  member_count: number;
  note_count: number;
  folder_count: number;
};

// API response type (snake_case from database)
type WorkspaceAPIResponse = {
  workspace_id: string;
  workspace_name: string;
  workspace_description: string | null;
  role: 'owner' | 'admin' | 'member';
  member_count: number;
  note_count: number;
  folder_count: number;
};

type WorkspaceManagerProps = {
  selectedWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
};

function WorkspaceManager({ 
  selectedWorkspaceId, 
  onWorkspaceChange 
}: WorkspaceManagerProps) {

  const getRoleIcon = (role?: 'owner' | 'admin' | 'member') => {
    if (role === 'owner') return <Crown className="h-4 w-4 text-yellow-500" />;
    if (role === 'admin') return <Shield className="h-4 w-4 text-blue-500" />;
    if (role === 'member') return <Users className="h-4 w-4" />;
    return null;
  };

  // State & derived data
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  // Clear create form error feedback when the dialog opens/closes or inputs change.
  useEffect(() => {
    if (!createDialogOpen) {
      setError(null);
      setNewWorkspace({ name: '', description: '' });
    }
  }, [createDialogOpen]);
  const selected = useMemo(() => workspaces.find(w => w.id === selectedWorkspaceId) || null, [workspaces, selectedWorkspaceId]);

  // After changing selection, scroll the info panel into view for quick confirmation
  useEffect(() => {
    if (selectedWorkspaceId) {
      const el = document.getElementById('current-workspace-info');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedWorkspaceId]);

  // Always render the static "Personal (Private)" option so users can switch back
  // to personal notes even if there exists a similarly named workspace.

  // Fetch workspaces
  const fetchWorkspaces = async () => {
    // Guard: components should pass valid data, but be defensive
    try {
      console.log('[WorkspaceManager] Fetching workspaces...');
      const response = await fetch('/api/workspaces');
      console.log('[WorkspaceManager] Response status:', response.status);
      
      if (!response.ok) {
        // Don't show error toast for 401 (user not authenticated yet)
        if (response.status === 401) {
          console.log('WorkspaceManager: User not authenticated yet');
          return;
        }
        throw new Error('Failed to fetch workspaces');
      }
      
      const data = await response.json();
      console.log('[WorkspaceManager] Received data:', data);
      console.log('[WorkspaceManager] Workspaces count:', data.workspaces?.length || 0);
      
      // Map API response (workspace_id, workspace_name) to component interface (id, name)
      const mappedWorkspaces = (data.workspaces || []).map((ws: WorkspaceAPIResponse) => ({
        id: ws.workspace_id,
        name: ws.workspace_name,
        description: ws.workspace_description,
        role: ws.role,
        member_count: ws.member_count || 0,
        note_count: ws.note_count || 0,
        folder_count: ws.folder_count || 0,
      }));
      console.log('[WorkspaceManager] Mapped workspaces:', mappedWorkspaces);
      
      setWorkspaces(mappedWorkspaces);
    } catch (err) {
      console.error('[WorkspaceManager] Error fetching workspaces:', err);
      setError('Failed to load workspaces');
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Create workspace
  const { run: runCreate, isRunning: creating } = useAsyncAction();
  const handleCreate = async () => {
    if (!newWorkspace.name.trim()) {
      setError('Workspace name is required');
      return;
    }
  // Client-side duplicate pre-check (case-insensitive) — defensive for missing names
  const exists = workspaces.some(w => (String(w.name || '')).toLowerCase() === newWorkspace.name.trim().toLowerCase());
    if (exists) {
      setError('You already have a workspace with this name');
      toast.error('Duplicate workspace name');
      return;
    }
    await runCreate(async () => {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkspace),
      });

      if (!response.ok) {
        if (response.status === 409) {
          const data = await response.json();
          setError(data.error || 'Duplicate workspace name');
          toast.error(data.error || 'Duplicate workspace name');
          return;
        }
        throw new Error('Failed to create workspace');
      }

      const data = await response.json();
      const created = { ...data.workspace, member_count: 1, note_count: 0, folder_count: 0 };
      setWorkspaces([...workspaces, created]);
      setNewWorkspace({ name: '', description: '' });
      setCreateDialogOpen(false);
      setError(null);
      toast.success('Workspace created');
      // Select newly created workspace immediately
      onWorkspaceChange(created.id);
    });
  };

  // Delete workspace
  const handleDelete = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace? All notes and folders will be deleted.')) {
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete workspace');

      setWorkspaces(workspaces.filter(w => w.id !== workspaceId));
      if (selectedWorkspaceId === workspaceId) {
        onWorkspaceChange(null);
      }
      toast.success('Workspace deleted');
    } catch (err) {
      console.error('Error deleting workspace:', err);
      setError('Failed to delete workspace');
      toast.error('Failed to delete workspace');
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading workspaces...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Workspace Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Workspace</label>
        <Select
          value={selectedWorkspaceId || 'personal'}
          onValueChange={(value) => onWorkspaceChange(value === 'personal' ? null : value)}
        >
          <SelectTrigger className="w-full" aria-label="Workspace selector">
            {selectedWorkspaceId ? (
              <div className="flex items-center gap-2">
                {getRoleIcon(selected?.role)}
                <span>{selected?.name || 'Workspace'}</span>
                {selected?.member_count !== undefined && selected.member_count > 1 && (
                  <span className="text-xs text-muted-foreground">
                    ({selected.member_count} {selected.member_count === 1 ? 'member' : 'members'})
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Personal (Private)</span>
              </div>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Personal (Private)</span>
              </div>
            </SelectItem>
            {(() => {
              console.log('[WorkspaceManager] Rendering workspaces, count:', workspaces.length);
              console.log('[WorkspaceManager] Workspaces:', workspaces);
              return workspaces.map((workspace, idx) => {
                console.log('[WorkspaceManager] Rendering workspace:', workspace.id, workspace.name);
                return (
                  <SelectItem key={`${workspace.id || 'ws'}-${idx}`} value={workspace.id}>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(workspace.role)}
                      <span>{workspace.name}</span>
                      {workspace.member_count > 1 && (
                        <span className="text-xs text-muted-foreground">
                          ({workspace.member_count} {workspace.member_count === 1 ? 'member' : 'members'})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              });
            })()}
          </SelectContent>
        </Select>
      </div>

      {/* Workspace Actions */}
      <div className="flex gap-2">
        {/* Create Workspace */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>
                Create a new workspace to collaborate with your team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g., Marketing Team"
                  value={newWorkspace.name}
                  onChange={(e) => {
                    setNewWorkspace({ ...newWorkspace, name: e.target.value });
                    if (error) setError(null);
                  }}
                  aria-label="New workspace name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  placeholder="What is this workspace for?"
                  value={newWorkspace.description}
                  onChange={(e) => {
                    setNewWorkspace({ ...newWorkspace, description: e.target.value });
                    if (error) setError(null);
                  }}
                  rows={3}
                  aria-label="New workspace description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Current Workspace */}
        {selectedWorkspaceId && (
          <WorkspaceSettings
            workspaceId={selectedWorkspaceId}
            workspace={workspaces.find(w => w.id === selectedWorkspaceId)}
            onDelete={() => handleDelete(selectedWorkspaceId)}
            onUpdate={fetchWorkspaces}
          />
        )}
      </div>

      {/* Current Workspace Info */}
      {selectedWorkspaceId && (
        <div id="current-workspace-info" className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selected.role === 'owner' && (<Crown className="h-5 w-5 text-yellow-500" />)}
                  {selected.role === 'admin' && (<Shield className="h-5 w-5 text-blue-500" />)}
                  {selected.role === 'member' && (<User className="h-5 w-5 text-gray-500" />)}
                  <h3 className="font-semibold text-foreground">
                    {selected.name}
                  </h3>
                </div>
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full font-medium uppercase">
                  {selected.role}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selected.description || 'No description'}
              </p>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {selected.member_count} members
                </span>
                <span className="flex items-center gap-1">
                  📝 {selected.note_count} notes
                </span>
                <span className="flex items-center gap-1">
                  📁 {selected.folder_count} folders
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { ErrorBoundary } from './ErrorBoundary';

export default function WorkspaceManagerWithBoundary(props: Parameters<typeof WorkspaceManager>[0]) {
  return (
    <ErrorBoundary>
      <WorkspaceManager {...props} />
    </ErrorBoundary>
  );
}

// Workspace Settings Dialog Component
function WorkspaceSettings({ 
  workspaceId, 
  workspace,
  onDelete,
  onUpdate 
}: { 
  workspaceId: string; 
  workspace?: Workspace;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  type Member = {
    id: string;
    role: string;
    user_id: string;
    status?: 'active' | 'pending';
    user?: { email?: string } | null;
  };
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<{ email: string; role: string; created_at: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (!response.ok) throw new Error('Failed to fetch members');
      
      const data = await response.json();
      setMembers(data.members || []);
      setPendingInvites(data.pending || []);
    } catch (err) {
      console.error('Error fetching members:', err);
      toast.error('Failed to load members');
    }
  };

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
    // fetchMembers is defined within the component and doesn't change reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Async guards for member actions
  const { run: runInvite, isRunning: inviting } = useAsyncAction();
  const { run: runRemoveMember, isRunning: removing } = useAsyncAction();
  const { run: runDelete, isRunning: deleting } = useAsyncAction();

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to invite member');
        toast.error(data.error || 'Failed to invite member');
        return;
      }

      setInviteEmail('');
      setError(null);
      fetchMembers();
      onUpdate();
      toast.success('Invitation sent');
    } catch (err) {
      console.error('Error inviting member:', err);
      setError('Failed to invite member');
      toast.error('Failed to invite member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the workspace?')) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove member');

      fetchMembers();
      onUpdate();
      toast.success('Member removed');
    } catch (err) {
      console.error('Error removing member:', err);
      setError('Failed to remove member');
      toast.error('Failed to remove member');
    }
  };

  const isOwnerOrAdmin = workspace?.role === 'owner' || workspace?.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>{workspace?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              className={`px-4 py-2 ${activeTab === 'members' ? 'border-b-2 border-primary' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </button>
            {isOwnerOrAdmin && (
              <button
                className={`px-4 py-2 ${activeTab === 'settings' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {isOwnerOrAdmin && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email to invite"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runInvite(() => handleInvite())}
                  />
                  <Button onClick={() => runInvite(() => handleInvite())} disabled={inviting}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Active Members ({members.length})
                </h3>
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        {getRoleIcon(member.role)}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{member.user?.email || 'Unknown'}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{member.role}</span>
                          {member.role === 'owner' && (
                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                              Owner
                            </span>
                          )}
                          {member.role === 'admin' && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isOwnerOrAdmin && member.role !== 'owner' && (
                      <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => runRemoveMember(() => handleRemoveMember(member.user_id))}
                                disabled={removing}
                                className="text-destructive hover:text-destructive"
                              >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                
                {/* Pending Invitations */}
                {pendingInvites.length > 0 && (
                  <>
                    <h3 className="text-sm font-medium text-foreground mt-6 mb-3">
                      Pending Invitations ({pendingInvites.length})
                    </h3>
                    {pendingInvites.map((invite, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-dashed rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{invite.email}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MailCheck className="h-3 w-3" />
                              <span>Invited {new Date(invite.created_at).toLocaleDateString()}</span>
                              <span>·</span>
                              <span className="capitalize">{invite.role}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                
                {members.length === 0 && pendingInvites.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground/40" />
                    <p>No members yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && workspace?.role === 'owner' && (
            <div className="space-y-4">
              <Button variant="destructive" onClick={() => runDelete(async () => { await Promise.resolve(onDelete()); })} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
