/**
 * Version History Component
 * 
 * Displays version history for a note with diff viewer
 * and restore functionality.
 */

'use client'

import { useState } from 'react'
import { useVersionHistory, type NoteVersion } from '@/lib/useRealtime'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import {
  History,
  RotateCcw,
  Clock,
  FileText,
  X,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface VersionHistoryProps {
  noteId: string | null
  currentNote?: {
    original_notes?: string
    summary?: string
    takeaways?: string[]
    actions?: { task: string; datetime?: string | null }[]
  }
  onRestore?: () => void
}

export function VersionHistory({ noteId, currentNote, onRestore }: VersionHistoryProps) {
  const { versions, loading, restoreVersion } = useVersionHistory(noteId)
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const handleRestore = async () => {
    if (!selectedVersion) return

    setRestoring(true)
    const success = await restoreVersion(selectedVersion.id)
    setRestoring(false)

    if (success) {
      setShowRestoreDialog(false)
      setSelectedVersion(null)
      onRestore?.()
    }
  }

  const renderDiff = (version: NoteVersion) => {
    return (
      <div className="space-y-4">
        {version.original_notes && (
          <div>
            <h4 className="text-sm font-medium mb-2">Original Notes</h4>
            <Card>
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap">{version.original_notes}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {version.summary && (
          <div>
            <h4 className="text-sm font-medium mb-2">Summary</h4>
            <Card>
              <CardContent className="p-3">
                <p className="text-sm">{version.summary}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {version.takeaways && version.takeaways.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Key Takeaways</h4>
            <Card>
              <CardContent className="p-3">
                <ul className="text-sm space-y-1">
                  {version.takeaways.map((takeaway: string, _i: number) => (
                    <li key={_i} className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {version.actions && version.actions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Action Items</h4>
            <Card>
              <CardContent className="p-3">
                <ul className="text-sm space-y-2">
                  {version.actions.map((action: { task: string; datetime?: string | null }, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div>
                        <p>{action.task}</p>
                        {action.datetime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {format(new Date(action.datetime), 'PPp')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {version.tags && version.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {version.tags.map((tag, i) => (
                <Badge key={i} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {version.sentiment && (
          <div>
            <h4 className="text-sm font-medium mb-2">Sentiment</h4>
            <Badge variant="outline">{version.sentiment}</Badge>
          </div>
        )}
      </div>
    )
  }

  if (!noteId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a note to view version history</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full" data-testid="version-history">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h2 className="font-semibold">
              Version History {versions.length > 0 && `(${versions.length})`}
            </h2>
          </div>
        </div>

        {/* Versions list */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading versions...</div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No version history yet</p>
                <p className="text-sm mt-2">Versions are created automatically when you edit notes</p>
              </div>
            ) : (
              <>
                {/* Current version */}
                {currentNote && (
                  <Card className="border-2 border-primary">
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-medium">
                            Current Version
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            <p className="text-xs text-muted-foreground mt-1">
                            You&apos;re viewing this version
                          </p>
                          </p>
                        </div>
                        <Badge variant="default">Current</Badge>
                      </div>
                    </CardHeader>
                  </Card>
                )}

                {/* Past versions */}
                {versions.map((version, _index) => (
                  <Card
                    key={version.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedVersion?.id === version.id ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <CardTitle className="text-sm font-medium">
                              Version {version.version_number}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(version.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                            <span>•</span>
                            <span>{format(new Date(version.created_at), 'PPp')}</span>
                          </div>
                          {version.change_description && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {version.change_description}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedVersion(version)
                            setShowRestoreDialog(true)
                          }}
                          className="flex-shrink-0"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Version detail */}
        {selectedVersion && !showRestoreDialog && (
          <div className="border-t p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Version {selectedVersion.version_number}</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowRestoreDialog(true)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedVersion(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[300px]">{renderDiff(selectedVersion)}</ScrollArea>
          </div>
        )}
      </div>

      {/* Restore confirmation dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version?</DialogTitle>
            <DialogDescription>
              This will replace the current note content with Version{' '}
              {selectedVersion?.version_number}. Your current version will be saved in history.
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="my-4">
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                {renderDiff(selectedVersion)}
              </ScrollArea>
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
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
