'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  History,
  GitBranch,
  GitCommit,
  RotateCcw,
  GitCompare,
  Clock,
  User,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Version {
  id: number;
  version_number: number;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  created_at: string;
  snapshot_type: 'auto' | 'manual' | 'restore';
  change_description?: string;
  changed_fields?: string[];
  parent_version_id?: number;
}

interface VersionHistoryProps {
  noteId: string;
  onCompare: (v1: number, v2: number) => void;
  className?: string;
}

const SNAPSHOT_TYPE_CONFIG = {
  auto: {
    label: 'Auto Save',
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  manual: {
    label: 'Manual',
    icon: GitCommit,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  restore: {
    label: 'Restored',
    icon: RotateCcw,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
};

export function VersionHistory({ noteId, onCompare, className }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  useEffect(() => {
    fetchVersions();
     // Note: fetchVersions is defined inline and depends on noteId
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notes/${noteId}/versions`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }

      const data = await response.json();
      setVersions(data.versions || []);
      } catch (_error) {
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: number) => {
    try {
      setRestoring(true);
      const response = await fetch(
        `/api/notes/${noteId}/versions/${versionId}/restore`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to restore version');
      }

        await response.json();
      
      toast.success(`Successfully restored to version ${selectedVersion?.version_number}`);

      setShowRestoreDialog(false);
      setSelectedVersion(null);
      
      // Refresh versions list
      await fetchVersions();
      
      // Reload the page to show restored content
      window.location.reload();
      } catch (_error) {
      toast.error('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  const handleCompare = () => {
    if (selectedVersion && compareVersion) {
      onCompare(Math.min(selectedVersion.id, compareVersion), Math.max(selectedVersion.id, compareVersion));
      setSelectedVersion(null);
      setCompareVersion(null);
    }
  };

  const toggleVersionSelection = (version: Version) => {
    if (selectedVersion?.id === version.id) {
      setSelectedVersion(null);
      setCompareVersion(null);
    } else if (!selectedVersion) {
      setSelectedVersion(version);
    } else {
      setCompareVersion(version.id);
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No version history available</p>
        <p className="text-sm mt-1">Versions will be created automatically when you edit the note</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5" />
          <h3 className="font-semibold">Version History</h3>
          <Badge variant="secondary">{versions.length}</Badge>
        </div>

        {selectedVersion && compareVersion && (
          <Button size="sm" onClick={handleCompare}>
            <GitCompare className="w-4 h-4 mr-2" />
            Compare Selected
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {versions.map((version, index) => {
            const config = SNAPSHOT_TYPE_CONFIG[version.snapshot_type];
            const Icon = config.icon;
            const isSelected = selectedVersion?.id === version.id || compareVersion === version.id;
            const isLatest = index === 0;

            return (
              <div
                key={version.id}
                className={cn(
                  'group relative p-4 rounded-lg border transition-all cursor-pointer',
                  isSelected && 'ring-2 ring-primary bg-accent',
                  !isSelected && 'hover:bg-accent/50'
                )}
                onClick={() => toggleVersionSelection(version)}
              >
                {/* Timeline connector */}
                {index < versions.length - 1 && (
                  <div className="absolute left-8 top-full h-2 w-0.5 bg-border" />
                )}

                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-full', config.bgColor)}>
                    <Icon className={cn('w-4 h-4', config.color)} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            Version {version.version_number}
                          </span>
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                          {isLatest && (
                            <Badge>Current</Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(version.created_at), { 
                            addSuffix: true 
                          })}
                        </p>
                      </div>

                      {!isLatest && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVersion(version);
                            setShowRestoreDialog(true);
                          }}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={version.user_avatar} alt={version.user_name} />
                        <AvatarFallback className="text-xs">
                          {version.user_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground truncate">
                        {version.user_name}
                      </span>
                    </div>

                    {version.change_description && (
                      <p className="text-sm text-muted-foreground italic">
                        {version.change_description}
                      </p>
                    )}

                    {version.changed_fields && version.changed_fields.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {version.changed_fields.map((field) => (
                          <Badge key={field} variant="secondary" className="text-xs">
                            {field.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Restore confirmation dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version?</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore to version {selectedVersion?.version_number}?
              This will create a new version with the restored content.
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  Created by <strong>{selectedVersion.user_name}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {formatDistanceToNow(new Date(selectedVersion.created_at), { 
                    addSuffix: true 
                  })}
                </span>
              </div>
              {selectedVersion.change_description && (
                <div className="flex items-start gap-2">
                  <GitBranch className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm italic text-muted-foreground">
                    {selectedVersion.change_description}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRestoreDialog(false)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedVersion && handleRestore(selectedVersion.id)}
              disabled={restoring}
            >
              {restoring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Restore Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
