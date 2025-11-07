"use client";
/* eslint-disable @next/next/no-img-element */

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Link as LinkIcon, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export type LinkPreviewNodeData = {
  url?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  favicon?: string;
  editing?: boolean;
};

function LinkPreviewNode({ data, selected }: NodeProps<LinkPreviewNodeData>) {
  const [editing, setEditing] = useState(data.editing ?? !data.url);
  const [url, setUrl] = useState(data.url ?? '');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    title?: string;
    description?: string;
    imageUrl?: string;
    favicon?: string;
  }>({
    title: data.title,
    description: data.description,
    imageUrl: data.imageUrl,
    favicon: data.favicon,
  });

  const fetchPreview = async (targetUrl: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (response.ok) {
        const previewData = await response.json();
        setPreview(previewData);
        
        // Update node data
        data.url = targetUrl;
        data.title = previewData.title;
        data.description = previewData.description;
        data.imageUrl = previewData.imageUrl;
        data.favicon = previewData.favicon;
      }
    } catch (error) {
      console.error('Failed to fetch link preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (url && url !== data.url) {
      fetchPreview(url);
    }
    setEditing(false);
    data.editing = false;
  };

  if (editing) {
    return (
      <div
        className={cn(
          "bg-background border-2 rounded-lg p-4 min-w-[300px]",
          selected ? "border-primary shadow-lg" : "border-border"
        )}
      >
        <Handle type="target" position={Position.Top} />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <LinkIcon className="h-4 w-4" />
              <span>Link Preview</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            className="text-xs"
            autoFocus
          />

          <Button
            size="sm"
            onClick={handleSave}
            className="w-full"
            disabled={!url.trim()}
          >
            Fetch Preview
          </Button>
        </div>

        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "bg-background border-2 rounded-lg overflow-hidden min-w-[300px] max-w-[400px]",
          selected ? "border-primary shadow-lg" : "border-border"
        )}
      >
        <Handle type="target" position={Position.Top} />
        
        <Skeleton className="h-[150px] w-full" />
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>

        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background border-2 rounded-lg overflow-hidden min-w-[300px] max-w-[400px] cursor-pointer hover:shadow-md transition-shadow",
        selected ? "border-primary shadow-lg" : "border-border"
      )}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Preview Image */}
      {preview.imageUrl && (
        <div className="relative w-full h-[150px] bg-muted overflow-hidden">
          <img
            src={preview.imageUrl}
            alt={preview.title || 'Link preview'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          {preview.favicon && (
            <img
              src={preview.favicon}
              alt=""
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium line-clamp-2 mb-1">
              {preview.title || url || 'Untitled'}
            </h3>
            {preview.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {preview.description}
              </p>
            )}
          </div>
        </div>

        {/* URL & Open Link */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground truncate flex-1">
            {url ? new URL(url).hostname : 'No URL'}
          </span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(LinkPreviewNode);
