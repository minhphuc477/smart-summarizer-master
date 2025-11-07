"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Template = {
  id: string;
  name: string;
  description: string;
  content?: string;
  category: string;
  is_system: boolean;
  created_at: string;
  persona_prompt?: string;
  structure?: string;
};

type TemplateSelectorProps = {
  onSelectTemplate: (template: Template) => void;
};

export default function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'meetings',
    persona_prompt: '',
    structure: ''
  });

  // Normalize raw template categories (from DB or defaults) to sidebar groups
  // DB seeds may contain values like: 'meeting', 'standup', 'project', 'review', 'brainstorm'
  // Sidebar groups are: 'meetings', 'development', 'planning', 'education'
  const toGroup = (cat: string | undefined): string => {
    const c = (cat || '').toLowerCase().trim();
    if (!c) return 'custom';
    if (
      [
        'meetings',
        'meeting',
        'standup',
        'daily standup',
        '1:1',
        '1-1',
        'interview',
      ].includes(c)
    ) return 'meetings';
    if (
      [
        'development',
        'review',
        'code review',
        'bug',
        'bug report',
        'qa',
      ].includes(c)
    ) return 'development';
    if (
      [
        'planning',
        'project',
        'project update',
        'roadmap',
        'brainstorm',
        'brainstorming',
        'product',
      ].includes(c)
    ) return 'planning';
    if (
      [
        'education',
        'lecture',
        'lecture notes',
        'research',
        'research summary',
        'study',
        'learning',
      ].includes(c)
    ) return 'education';
    // Fallback: if the raw category already matches a group id, keep it; otherwise mark as custom
    return ['meetings', 'development', 'planning', 'education'].includes(c) ? c : 'custom';
  };

  const groupLabel = (groupId: string) => {
    switch (groupId) {
      case 'meetings':
        return 'Meetings';
      case 'development':
        return 'Development';
      case 'planning':
        return 'Planning';
      case 'education':
        return 'Education';
      case 'custom':
        return 'Custom';
      default:
        return groupId.charAt(0).toUpperCase() + groupId.slice(1);
    }
  };

  const categories = [
    { id: 'all', name: 'All Templates' },
    { id: 'meetings', name: 'Meetings' },
    { id: 'development', name: 'Development' },
    { id: 'planning', name: 'Planning' },
    { id: 'education', name: 'Education' },
    { id: 'custom', name: 'My Templates' },
  ];

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        // Don't show error for auth issues during initial load
        if (response.status !== 401) {
          toast.error('Failed to load templates');
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      // Don't show toast for network errors during initial load
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    onSelectTemplate(template);
    setOpen(false);
    toast.success(`Template "${template.name}" applied`);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Template deleted');
        loadTemplates();
      } else {
        toast.error('Failed to delete template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Error deleting template');
    }
  };

  const byCategory = selectedCategory === 'all'
    ? templates
    : selectedCategory === 'custom'
    ? templates.filter(t => !t.is_system)
    : templates.filter(t => toGroup(t.category) === selectedCategory);

  const filteredTemplates = byCategory.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-[1120px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-2 px-1">
          <div className="flex-1">
            <Input
              placeholder="Search templates by name, description, category..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {/* Mobile category pills */}
        <div className="md:hidden -mt-2 mb-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 pr-1">
            {categories.map((category) => (
              <button
                key={`mobile-${category.id}`}
                onClick={() => setSelectedCategory(category.id)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-sm border transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent border-border'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

          <div className="flex md:flex-row flex-col gap-4 h-[70vh]">
          {/* Categories Sidebar (desktop/tablet) */}
          <div className="hidden md:block w-44 shrink-0 space-y-1 pr-2 border-r">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                {category.name}
              </button>
            ))}
            <Button className="mt-4 w-full" size="sm" onClick={() => setCreateOpen(true)}>
              Create Template
            </Button>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates found
              </div>
            ) : (
              <div
                className={`grid gap-3 pb-2`}
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}
              >
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`p-3 h-full w-full max-w-full flex flex-col gap-2 cursor-pointer hover:border-primary transition-colors group relative`}
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className={`font-medium whitespace-normal break-words text-[13px] leading-snug line-clamp-2`}>{template.name}</h3>
                      </div>
                      {template.is_system && (
                        <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
                      )}
                      {!template.is_system && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(template.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className={`text-xs text-muted-foreground line-clamp-2`}>
                      {template.description}
                    </p>
                    <div className="mt-auto pt-2 text-xs">
                      <span className="inline-block px-2 py-1 bg-accent rounded-full">
                        {groupLabel(toGroup(template.category))}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Category (e.g., meetings, planning)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <Textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Textarea
              placeholder="Persona prompt (optional)"
              value={form.persona_prompt}
              onChange={(e) => setForm({ ...form, persona_prompt: e.target.value })}
            />
            <Textarea
              placeholder="Structure or starter content"
              value={form.structure}
              onChange={(e) => setForm({ ...form, structure: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  setCreating(true);
                  try {
                    const res = await fetch('/api/templates', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(form),
                    });
                    if (res.ok) {
                      setCreateOpen(false);
                      await loadTemplates();
                    }
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating || !form.name.trim() || !form.category.trim() || !form.structure.trim()}
              >
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
