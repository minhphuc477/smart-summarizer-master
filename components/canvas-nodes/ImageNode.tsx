"use client";
/* eslint-disable @next/next/no-img-element */

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Image as ImageIcon, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ImageNodeData = {
  label?: string;
  imageUrl?: string;
  alt?: string;
  caption?: string;
  link?: string;
  editing?: boolean;
};

function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const [editing, setEditing] = useState(data.editing ?? false);
  const [imageUrl, setImageUrl] = useState(data.imageUrl ?? '');
  const [caption, setCaption] = useState(data.caption ?? '');
  const [alt, setAlt] = useState(data.alt ?? '');
  const [link, setLink] = useState(data.link ?? '');
  const [imageError, setImageError] = useState(false);

  const handleSave = () => {
    // Update node data through ReactFlow
    data.imageUrl = imageUrl;
    data.caption = caption;
    data.alt = alt;
    data.link = link;
    data.editing = false;
    setEditing(false);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  if (editing) {
    return (
      <div
        className={cn(
          "bg-background border-2 rounded-lg p-4 min-w-[280px]",
          selected ? "border-primary shadow-lg" : "border-border"
        )}
      >
        <Handle type="target" position={Position.Top} />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4" />
              <span>Image Node</span>
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
            placeholder="Image URL"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setImageError(false);
            }}
            className="text-xs"
          />
          
          <Input
            placeholder="Alt text (for accessibility)"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            className="text-xs"
          />
          
          <Input
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="text-xs"
          />
          
          <Input
            placeholder="Link URL (optional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="text-xs"
          />

          <Button
            size="sm"
            onClick={handleSave}
            className="w-full"
          >
            Save
          </Button>
        </div>

        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background border-2 rounded-lg overflow-hidden min-w-[200px] max-w-[400px]",
        selected ? "border-primary shadow-lg" : "border-border"
      )}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Image Display */}
      <div className="relative group">
        {imageUrl && !imageError ? (
          <>
            <img
              src={imageUrl}
              alt={alt || caption || 'Canvas image'}
              className="w-full h-auto max-h-[300px] object-cover"
              onError={handleImageError}
              loading="lazy"
            />
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="secondary">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-[150px] bg-muted">
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
              <p className="text-xs">
                {imageError ? 'Failed to load image' : 'Double-click to add image'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      {caption && (
        <div className="p-2 bg-muted/50 text-xs text-center text-muted-foreground border-t">
          {caption}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ImageNode);
