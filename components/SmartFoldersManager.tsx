"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Edit, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type SmartFolder = {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  rules: {
    keywords?: string[];
    tags?: string[];
    min_similarity?: number;
  };
  auto_assign: boolean;
  note_count: number;
  created_at: string;
  updated_at: string;
};

export default function SmartFoldersManager() {
  const [folders, setFolders] = useState<SmartFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SmartFolder | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('🤖');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formKeywords, setFormKeywords] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formMinSimilarity, setFormMinSimilarity] = useState(0.5);
  const [formAutoAssign, setFormAutoAssign] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/smart-folders');
      if (!res.ok) throw new Error('Failed to fetch smart folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (err) {
      toast.error('Failed to load smart folders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingFolder(null);
    setFormName('');
    setFormDescription('');
    setFormIcon('🤖');
    setFormColor('#3b82f6');
    setFormKeywords('');
    setFormTags('');
    setFormMinSimilarity(0.5);
    setFormAutoAssign(true);
    setShowDialog(true);
  };

  const openEditDialog = (folder: SmartFolder) => {
    setEditingFolder(folder);
    setFormName(folder.name);
    setFormDescription(folder.description || '');
    setFormIcon(folder.icon);
    setFormColor(folder.color);
    setFormKeywords((folder.rules.keywords || []).join(', '));
    setFormTags((folder.rules.tags || []).join(', '));
    setFormMinSimilarity(folder.rules.min_similarity || 0.5);
    setFormAutoAssign(folder.auto_assign);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    const keywords = formKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);

    if (keywords.length === 0 && tags.length === 0) {
      toast.error('At least one keyword or tag is required');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        icon: formIcon,
        color: formColor,
        rules: {
          keywords,
          tags,
          min_similarity: formMinSimilarity
        },
        auto_assign: formAutoAssign
      };

      const url = editingFolder ? `/api/smart-folders/${editingFolder.id}` : '/api/smart-folders';
      const method = editingFolder ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save smart folder');
      }

      toast.success(editingFolder ? 'Smart folder updated' : 'Smart folder created');
      setShowDialog(false);
      await fetchFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save smart folder');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (folderId: number, name: string) => {
    if (!confirm(`Delete smart folder "${name}"? This will remove all auto-categorizations.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/smart-folders/${folderId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete smart folder');

      toast.success('Smart folder deleted');
      await fetchFolders();
    } catch (err) {
      toast.error('Failed to delete smart folder');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Smart Folders</h3>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Smart Folders</h3>
          <p className="text-sm text-muted-foreground">
            Auto-categorize your notes based on keywords and tags
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Smart Folder
        </Button>
      </div>

      {folders.length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h4 className="text-lg font-medium mb-2">No smart folders yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create smart folders to automatically organize your notes by topics
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Smart Folder
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <Card key={folder.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{folder.icon}</span>
                  <div>
                    <h4 className="font-medium">{folder.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {folder.note_count} {folder.note_count === 1 ? 'note' : 'notes'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openEditDialog(folder)}
                    aria-label="Edit folder"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDelete(folder.id, folder.name)}
                    aria-label="Delete folder"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {folder.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {folder.description}
                </p>
              )}

              <div className="space-y-2">
                {folder.rules.keywords && folder.rules.keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Keywords:</p>
                    <div className="flex flex-wrap gap-1">
                      {folder.rules.keywords.slice(0, 3).map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                      {folder.rules.keywords.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{folder.rules.keywords.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {folder.rules.tags && folder.rules.tags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Tags:</p>
                    <div className="flex flex-wrap gap-1">
                      {folder.rules.tags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {folder.rules.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{folder.rules.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    Auto-assign: {folder.auto_assign ? 'Yes' : 'No'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(folder.rules.min_similarity || 0.5) * 100}% match
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? 'Edit Smart Folder' : 'Create Smart Folder'}
            </DialogTitle>
            <DialogDescription>
              Define rules to automatically categorize your notes into this folder
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Work Projects"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Icon</label>
                <Input 
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="🤖"
                  maxLength={4}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What types of notes belong in this folder?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Keywords (comma-separated) *</label>
              <Input 
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                placeholder="e.g., project, deadline, meeting"
              />
              <p className="text-xs text-muted-foreground">
                Notes containing these keywords will be automatically added
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags (comma-separated)</label>
              <Input 
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="e.g., work, urgent, planning"
              />
              <p className="text-xs text-muted-foreground">
                Notes with these tags will be automatically added
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Minimum Match Score: {(formMinSimilarity * 100).toFixed(0)}%
                </label>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formMinSimilarity}
                  onChange={(e) => setFormMinSimilarity(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  How well notes must match rules to be included
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Auto-assign</label>
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox"
                    checked={formAutoAssign}
                    onChange={(e) => setFormAutoAssign(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Automatically categorize new notes</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingFolder ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
