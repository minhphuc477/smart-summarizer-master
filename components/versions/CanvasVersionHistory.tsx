"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, RotateCcw, Save } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type CanvasVersion = {
  id: number;
  canvas_id: string;
  user_id: string;
  version_number: number;
  snapshot_type?: string | null;
  change_description?: string | null;
  changed_fields?: string[] | null;
  diff_summary?: { node_count?: number; edge_count?: number } | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
};

interface Props {
  canvasId: string;
  onRestore?: () => void;
}

export default function CanvasVersionHistory({ canvasId, onRestore }: Props) {
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/canvases/${canvasId}/versions`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) setVersions(data.versions || []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [canvasId]);

  const restore = async (versionId: number) => {
    setRestoringId(versionId);
    try {
      const res = await fetch(`/api/canvases/${canvasId}/versions/${versionId}/restore`, { method: 'POST' });
      if (res.ok) {
        onRestore?.();
      }
    } finally {
      setRestoringId(null);
    }
  };

  const createSnapshot = async () => {
    setCreating(true);
    try {
      const createRes = await fetch(`/api/canvases/${canvasId}/versions`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_description: 'Manual snapshot' })
      });
      
      if (!createRes.ok) {
        const error = await createRes.json();
        console.error('Failed to create snapshot:', error);
        alert(`Failed to save snapshot: ${error.error || 'Unknown error'}`);
        return;
      }
      
      // Reload versions list
      const res = await fetch(`/api/canvases/${canvasId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Error creating snapshot:', error);
      alert('Failed to save snapshot. Check console for details.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Canvas Versions
          </CardTitle>
          <Button size="sm" variant="outline" onClick={createSnapshot} disabled={creating}>
            <Save className="h-4 w-4 mr-2" /> {creating ? 'Saving…' : 'Save Snapshot'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : versions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No versions yet. Save your canvas to create the first snapshot.</div>
        ) : (
          <ScrollArea className="h-[60vh] pr-4">
            <ul className="space-y-3">
              {versions.map(v => (
                <li key={v.id} className="border rounded-md p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Version {v.version_number} <span className="text-xs text-muted-foreground">({v.snapshot_type || 'auto'})</span></div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                      {v.user_name ? ` • by ${v.user_name}` : ''}
                    </div>
                    {v.diff_summary && (
                      <div className="text-xs text-muted-foreground mt-1">
                        nodes: {v.diff_summary.node_count ?? 0}, edges: {v.diff_summary.edge_count ?? 0}
                      </div>
                    )}
                    {v.change_description && (
                      <div className="text-xs mt-1">{v.change_description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restore(v.id)}
                      disabled={restoringId === v.id}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {restoringId === v.id ? 'Restoring…' : 'Restore'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
