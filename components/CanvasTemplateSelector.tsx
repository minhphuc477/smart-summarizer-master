"use client";

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PanelsTopLeft, 
  Search, 
  Star, 
  TrendingUp, 
  User,
  Globe,
  Sparkles,
  Grid3x3,
  GitBranch,
  Brain,
  ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';
import { Node, Edge } from 'reactflow';

interface CanvasTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  use_count: number;
  creator_id: string;
  is_public: boolean;
  is_featured: boolean;
  is_system: boolean;
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
  created_at: string;
}

interface CanvasTemplateSelectorProps {
  onSelectTemplate: (template: CanvasTemplate) => void;
  workspaceId?: string | null;
  children?: React.ReactNode;
}

const categoryIcons: Record<string, React.ReactNode> = {
  brainstorming: <Brain className="h-4 w-4" />,
  planning: <ListChecks className="h-4 w-4" />,
  diagram: <GitBranch className="h-4 w-4" />,
  'mind-map': <Grid3x3 className="h-4 w-4" />,
  workflow: <GitBranch className="h-4 w-4" />,
  custom: <Sparkles className="h-4 w-4" />,
  other: <PanelsTopLeft className="h-4 w-4" />,
};

export function CanvasTemplateSelector({
  onSelectTemplate,
  children,
}: CanvasTemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<CanvasTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('featured');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (searchQuery) {
        params.set('search', searchQuery);
      } else if (activeTab === 'featured') {
        params.set('featured', 'true');
      } else if (activeTab !== 'all') {
        params.set('category', activeTab);
      }
      
      params.set('limit', '20');

      const response = await fetch(`/api/canvas/templates?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleSelectTemplate = async (template: CanvasTemplate) => {
    try {
      // Fetch full template details with usage tracking
      const response = await fetch(
        `/api/canvas/templates/${template.id}?record_usage=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load template');
      }

      const data = await response.json();
      onSelectTemplate(data.template);
      setOpen(false);
      toast.success(`Loaded template: ${template.name}`);
    } catch (error) {
      console.error('Failed to load template:', error);
      toast.error('Failed to load template');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <PanelsTopLeft className="h-4 w-4 mr-2" />
            Templates
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Canvas Templates</DialogTitle>
          <DialogDescription>
            Choose from pre-built templates or create your own
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 sm:grid-cols-7 w-full gap-1">
              <TabsTrigger value="featured" className="text-xs sm:text-sm">
                <Star className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Featured</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                <Globe className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">All</span>
              </TabsTrigger>
              <TabsTrigger value="brainstorming" className="text-xs sm:text-sm">
                <Brain className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Brainstorm</span>
              </TabsTrigger>
              <TabsTrigger value="planning" className="text-xs sm:text-sm">
                <ListChecks className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Planning</span>
              </TabsTrigger>
              <TabsTrigger value="diagram" className="text-xs sm:text-sm">
                <GitBranch className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Diagram</span>
              </TabsTrigger>
              <TabsTrigger value="mind-map" className="text-xs sm:text-sm">
                <Grid3x3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Mind Map</span>
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs sm:text-sm">
                <User className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Mine</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <PanelsTopLeft className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? 'No templates found matching your search'
                        : 'No templates available in this category'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={() => handleSelectTemplate(template)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateCardProps {
  template: CanvasTemplate;
  onSelect: () => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <button
      onClick={onSelect}
      className="group relative flex flex-col rounded-lg border bg-card p-4 text-left hover:bg-accent transition-colors"
    >
      {/* Thumbnail or placeholder */}
      <div className="relative aspect-video rounded-md bg-muted mb-3 overflow-hidden">
          {template.thumbnail_url ? (
            <Image
              src={template.thumbnail_url}
              alt={template.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority={false}
            />
        ) : (
          <div className="flex items-center justify-center h-full">
            {categoryIcons[template.category] || categoryIcons.other}
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          {template.is_featured && (
            <Badge variant="secondary" className="text-xs">
              <Star className="h-3 w-3 fill-current" />
            </Badge>
          )}
          {template.is_system && (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3" />
            </Badge>
          )}
          {template.is_public && (
            <Badge variant="secondary" className="text-xs">
              <Globe className="h-3 w-3" />
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
          {template.name}
        </h3>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {template.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {template.category}
        </Badge>
        {template.use_count > 0 && (
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {template.use_count}
          </span>
        )}
      </div>
    </button>
  );
}
