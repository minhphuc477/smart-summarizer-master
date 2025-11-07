'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeftRight,
  Plus,
  Minus,
  Clock,
  User,
  Loader2,
  FileText,
  List,
  Tag,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';

interface VersionInfo {
  id: number;
  version_number: number;
  created_at: string;
  user_name: string;
  snapshot_type: string;
}

interface FieldChange {
  old: string | string[] | Record<string, unknown> | null;
  new: string | string[] | Record<string, unknown> | null;
  changed: boolean;
  added?: string[];
  removed?: string[];
}

interface DiffData {
  version1: VersionInfo;
  version2: VersionInfo;
  changes: {
    original_notes: FieldChange;
    summary: FieldChange;
    takeaways: FieldChange;
    actions: FieldChange;
    tags: FieldChange;
    sentiment: FieldChange;
  };
}

interface DiffViewProps {
  noteId: string;
  version1Id: number;
  version2Id: number;
  onClose: () => void;
}

function TextDiff({ oldText, newText }: { oldText: string; newText: string }) {
  // Simple character-level diff
 const [view, _setView] = useState<'unified' | 'split'>('split');

  if (!oldText && !newText) {
    return <div className="text-muted-foreground italic">No content</div>;
  }

  if (view === 'split') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Minus className="w-4 h-4 text-red-600" />
            Old Version
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
            <pre className="text-sm whitespace-pre-wrap break-words">
              {oldText || <span className="text-muted-foreground italic">Empty</span>}
            </pre>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-green-600" />
            New Version
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <pre className="text-sm whitespace-pre-wrap break-words">
              {newText || <span className="text-muted-foreground italic">Empty</span>}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Unified view
  return (
    <div className="space-y-2">
      {oldText && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
          <div className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
            <Minus className="w-4 h-4" />
            Removed
          </div>
          <pre className="text-sm whitespace-pre-wrap break-words">{oldText}</pre>
        </div>
      )}
      {newText && (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
          <div className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Added
          </div>
          <pre className="text-sm whitespace-pre-wrap break-words">{newText}</pre>
        </div>
      )}
    </div>
  );
}

function ArrayDiff({ added, removed }: { added: string[]; removed: string[] }) {
  if (added.length === 0 && removed.length === 0) {
    return <div className="text-muted-foreground italic">No changes</div>;
  }

  return (
    <div className="space-y-3">
      {removed.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-red-600 flex items-center gap-2">
            <Minus className="w-4 h-4" />
            Removed ({removed.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {removed.map((item, index) => (
              <Badge
                key={index}
                variant="outline"
                className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {added.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-green-600 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Added ({added.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {added.map((item, index) => (
              <Badge
                key={index}
                variant="outline"
                className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DiffView({ noteId, version1Id, version2Id, onClose }: DiffViewProps) {
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiff();
     // Note: fetchDiff is defined inline and depends on noteId, version1Id, version2Id
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, version1Id, version2Id]);

  const fetchDiff = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/notes/${noteId}/versions/compare?v1=${version1Id}&v2=${version2Id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch diff');
      }

      const data = await response.json();
      setDiff(data.diff);
      } catch (_error) {
      toast.error('Failed to load version comparison');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Failed to load comparison</p>
      </div>
    );
  }

  const changedFields = Object.entries(diff.changes).filter(([_, change]) => change.changed);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6" />
            Version Comparison
          </h2>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Version {diff.version1.version_number}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              {diff.version1.user_name}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Clock className="w-4 h-4" />
              {formatDistanceToNow(new Date(diff.version1.created_at), { addSuffix: true })}
            </div>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Version {diff.version2.version_number}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              {diff.version2.user_name}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Clock className="w-4 h-4" />
              {formatDistanceToNow(new Date(diff.version2.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} changed
          </Badge>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {changedFields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No changes</p>
              <p className="text-sm mt-2">These versions are identical</p>
            </div>
          ) : (
            <Tabs defaultValue="all" className="space-y-6">
              <TabsList>
                <TabsTrigger value="all">All Changes</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                {diff.changes.original_notes.changed && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Original Notes</h3>
                    </div>
                    <TextDiff
                      oldText={diff.changes.original_notes.old as string}
                      newText={diff.changes.original_notes.new as string}
                    />
                  </div>
                )}

                {diff.changes.summary.changed && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Summary</h3>
                    </div>
                    <TextDiff
                      oldText={diff.changes.summary.old as string}
                      newText={diff.changes.summary.new as string}
                    />
                  </div>
                )}

                {diff.changes.takeaways.changed && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <List className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Takeaways</h3>
                    </div>
                    <ArrayDiff
                      added={diff.changes.takeaways.added || []}
                      removed={diff.changes.takeaways.removed || []}
                    />
                  </div>
                )}

                {diff.changes.tags.changed && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Tags</h3>
                    </div>
                    <ArrayDiff
                      added={diff.changes.tags.added || []}
                      removed={diff.changes.tags.removed || []}
                    />
                  </div>
                )}

                {diff.changes.actions.changed && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Actions</h3>
                    </div>
                    <TextDiff
                      oldText={JSON.stringify(diff.changes.actions.old, null, 2)}
                      newText={JSON.stringify(diff.changes.actions.new, null, 2)}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="content" className="space-y-6">
                {/* Only show content-related changes */}
                {(diff.changes.original_notes.changed || diff.changes.summary.changed) ? (
                  <>
                    {diff.changes.original_notes.changed && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Original Notes</h3>
                        <TextDiff
                          oldText={diff.changes.original_notes.old as string}
                          newText={diff.changes.original_notes.new as string}
                        />
                      </div>
                    )}
                    {diff.changes.summary.changed && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Summary</h3>
                        <TextDiff
                          oldText={diff.changes.summary.old as string}
                          newText={diff.changes.summary.new as string}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No content changes
                  </div>
                )}
              </TabsContent>

              <TabsContent value="metadata" className="space-y-6">
                {/* Only show metadata changes */}
                {(diff.changes.takeaways.changed || diff.changes.tags.changed || diff.changes.actions.changed) ? (
                  <>
                    {diff.changes.takeaways.changed && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Takeaways</h3>
                        <ArrayDiff
                          added={diff.changes.takeaways.added || []}
                          removed={diff.changes.takeaways.removed || []}
                        />
                      </div>
                    )}
                    {diff.changes.tags.changed && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Tags</h3>
                        <ArrayDiff
                          added={diff.changes.tags.added || []}
                          removed={diff.changes.tags.removed || []}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No metadata changes
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
