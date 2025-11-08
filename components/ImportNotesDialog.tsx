/**
 * Import Notes to Canvas Dialog
 * Allows users to select existing notes and import them as canvas nodes
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Search, FileText, Folder, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface Note {
  id: number
  summary: string
  takeaways: string[]
  actions: Array<{ task: string; datetime?: string | null }>
  persona: string
  sentiment: string
  created_at: string
  folder_id?: number | null
  folders?: { name: string; color: string } | null
  note_tags?: Array<{ tags: { name: string } }>
}

interface ImportNotesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (notes: Note[]) => void
  workspaceId?: string | null
}

export function ImportNotesDialog({
  open,
  onOpenChange,
  onImport,
  workspaceId,
}: ImportNotesDialogProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set())

  const fetchNotes = async () => {
    setLoading(true)
    try {
      const url = workspaceId 
        ? `/api/workspaces/${workspaceId}/notes`
        : '/api/notes'
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch notes')
      
      const data = await response.json()
      setNotes(data.notes || data || [])
    } catch (error) {
      console.error('Failed to fetch notes:', error)
      toast.error('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchNotes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId])

  const filteredNotes = notes.filter(note => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      note.summary.toLowerCase().includes(query) ||
      note.takeaways?.some(t => t.toLowerCase().includes(query)) ||
      note.note_tags?.some(nt => nt.tags.name.toLowerCase().includes(query))
    )
  })

  const toggleNoteSelection = (noteId: number) => {
    const newSelected = new Set(selectedNotes)
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId)
    } else {
      newSelected.add(noteId)
    }
    setSelectedNotes(newSelected)
  }

  const handleImport = () => {
    const notesToImport = notes.filter(note => selectedNotes.has(note.id))
    if (notesToImport.length === 0) {
      toast.error('Please select at least one note')
      return
    }
    onImport(notesToImport)
    onOpenChange(false)
    setSelectedNotes(new Set())
    toast.success(`Imported ${notesToImport.length} note(s) to canvas`)
  }

  const selectAll = () => {
    setSelectedNotes(new Set(filteredNotes.map(n => n.id)))
  }

  const deselectAll = () => {
    setSelectedNotes(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Notes to Canvas</DialogTitle>
          <DialogDescription>
            Select notes to import as nodes on your canvas. Each note will become a structured node with its summary, takeaways, and actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Search and selection controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes by summary, takeaways, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={filteredNotes.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedNotes.size === 0}
            >
              Clear
            </Button>
          </div>

          {/* Notes list with ScrollArea */}
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
            <ScrollArea className="h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-muted-foreground">Loading notes...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No notes match your search' : 'No notes found'}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedNotes.has(note.id)
                        ? 'bg-primary/5 border-primary'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => toggleNoteSelection(note.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedNotes.has(note.id)}
                        onCheckedChange={() => toggleNoteSelection(note.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Summary */}
                        <p className="font-medium line-clamp-2">{note.summary}</p>
                        
                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                          </div>
                          
                          {note.folders && (
                            <div className="flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              <Badge variant="outline" style={{ borderColor: note.folders.color }}>
                                {note.folders.name}
                              </Badge>
                            </div>
                          )}
                          
                          {note.sentiment && (
                            <Badge variant="secondary">{note.sentiment}</Badge>
                          )}
                        </div>
                        
                        {/* Tags */}
                        {note.note_tags && note.note_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {note.note_tags.map((nt, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {nt.tags.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {/* Counts */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{note.takeaways?.length || 0} takeaways</span>
                          <span>•</span>
                          <span>{note.actions?.length || 0} actions</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </ScrollArea>
          </div>

          {/* Selected count */}
          {selectedNotes.size > 0 && (
            <div className="text-sm text-muted-foreground flex-shrink-0">
              {selectedNotes.size} note{selectedNotes.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={selectedNotes.size === 0}>
            Import {selectedNotes.size > 0 && `(${selectedNotes.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
