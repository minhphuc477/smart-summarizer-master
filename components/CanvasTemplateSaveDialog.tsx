"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Node, Edge } from 'reactflow';

interface CanvasTemplateSaveDialogProps {
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
  workspaceId?: string | null;
  onTemplateSaved?: (templateId: string) => void;
  children?: React.ReactNode;
}

const categories = [
  { value: 'custom', label: 'Custom' },
  { value: 'brainstorming', label: 'Brainstorming' },
  { value: 'planning', label: 'Planning' },
  { value: 'diagram', label: 'Diagram' },
  { value: 'mind-map', label: 'Mind Map' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'other', label: 'Other' },
];

export function CanvasTemplateSaveDialog({
  nodes,
  edges,
  viewport,
  workspaceId,
  onTemplateSaved,
  children,
}: CanvasTemplateSaveDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [isPublic, setIsPublic] = useState(false);
  const [tags, setTags] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('custom');
    setIsPublic(false);
    setTags('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (nodes.length === 0) {
      toast.error('Cannot save an empty canvas as a template');
      return;
    }

    setSaving(true);

    try {
      // Parse tags from comma-separated string
      const tagArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const response = await fetch('/api/canvas/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category,
          nodes,
          edges,
          viewport: viewport || { x: 0, y: 0, zoom: 1 },
          workspace_id: workspaceId,
          is_public: isPublic,
          tags: tagArray,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save template');
      }

      const data = await response.json();
      
      toast.success('Template saved successfully!');
      resetForm();
      setOpen(false);
      
      if (onTemplateSaved) {
        onTemplateSaved(data.template.id);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save template'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save as Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Canvas as Template</DialogTitle>
          <DialogDescription>
            Create a reusable template from your current canvas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g., Project Planning Board"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Describe what this template is for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="template-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="template-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="template-tags">Tags</Label>
            <Input
              id="template-tags"
              placeholder="tag1, tag2, tag3"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated tags for easier searching
            </p>
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="template-public">Make Public</Label>
              <p className="text-xs text-muted-foreground">
                Allow others to discover and use this template
              </p>
            </div>
            <Switch
              id="template-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          {/* Stats */}
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              This template will include:
            </p>
            <ul className="text-sm space-y-1 mt-2">
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{nodes.length} nodes</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{edges.length} connections</span>
              </li>
              {workspaceId && (
                <li className="flex items-center gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Shared with workspace</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              setOpen(false);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
