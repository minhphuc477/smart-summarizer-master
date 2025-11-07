'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
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
import type { NoteVersion } from '@/lib/realtime/types';

interface VersionHistoryProps {
  versions: NoteVersion[];
  currentVersion: number;
  onRestore: (versionId: number) => void;
  loading?: boolean;
}

export function VersionHistory({
  versions,
  currentVersion,
  onRestore,
  loading = false,
}: VersionHistoryProps) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Loading version history...</p>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          No version history available yet.
        </p>
      </div>
    );
  }

  const handleRestore = (versionId: number) => {
    setRestoreConfirm(versionId);
  };

  const confirmRestore = () => {
    if (restoreConfirm) {
      onRestore(restoreConfirm);
      setRestoreConfirm(null);
    }
  };

  const getChangeStats = (version: NoteVersion) => {
    const stats: string[] = [];
    
    if (version.takeaways && Array.isArray(version.takeaways)) {
      stats.push(`${version.takeaways.length} takeaway${version.takeaways.length !== 1 ? 's' : ''}`);
    }
    if (version.actions && Array.isArray(version.actions)) {
      stats.push(`${version.actions.length} action${version.actions.length !== 1 ? 's' : ''}`);
    }
    if (version.tags && version.tags.length > 0) {
      stats.push(`${version.tags.length} tag${version.tags.length !== 1 ? 's' : ''}`);
    }
    
    return stats.join(', ');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Version History</h3>
      
      <ScrollArea className="h-[500px] pr-4">
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          
          {versions.map((version) => {
            const isCurrent = version.version_number === currentVersion;
            const isExpanded = expandedVersion === version.id;
            
            return (
              <div
                key={version.id}
                data-version={version.version_number}
                className={`relative pl-10 ${isCurrent ? 'current' : ''}`}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                    isCurrent
                      ? 'bg-primary border-primary'
                      : 'bg-background border-border'
                  }`}
                />
                
                <div
                  className={`rounded-lg border p-4 ${
                    isCurrent ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedVersion(isExpanded ? null : version.id)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Version {version.version_number}
                          </span>
                          {isCurrent && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {version.user_name || version.user_email} •{' '}
                          {formatDistanceToNow(new Date(version.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      
                      {!isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(version.id);
                          }}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      {version.change_description && (
                        <p className="text-sm text-muted-foreground">
                          {version.change_description}
                        </p>
                      )}
                      
                      <div className="text-sm">
                        <span className="text-muted-foreground">Changes: </span>
                        {getChangeStats(version) || 'No details available'}
                      </div>
                      
                      {version.summary && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Summary</h4>
                          <p className="text-sm text-muted-foreground">
                            {version.summary}
                          </p>
                        </div>
                      )}
                      
                      {version.takeaways && Array.isArray(version.takeaways) && version.takeaways.length > 0 && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Takeaways</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {version.takeaways.map((takeaway, idx) => (
                              <li key={idx}>{takeaway}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {version.tags && version.tags.length > 0 && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Tags</h4>
                          <div className="flex gap-1 flex-wrap">
                            {version.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {version.sentiment && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Sentiment</h4>
                          <Badge variant="outline">{version.sentiment}</Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      {/* Restore confirmation dialog */}
      <Dialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version?</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore this version? Your current changes will be saved as a new version before restoring.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRestore}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
