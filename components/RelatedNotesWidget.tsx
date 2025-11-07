"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, Link2, Sparkles, Eye } from 'lucide-react';
import { toast } from 'sonner';

type RelatedNote = {
  id: number;
  summary: string | null;
  original_notes: string | null;
  persona: string | null;
  created_at: string;
  similarity: number;
};

type LinkedNote = {
  id: number;
  note_id: number;
  similarity_score: number;
  link_type: string;
  created_by: string;
  direction: 'incoming' | 'outgoing';
  note: {
    id: number;
    summary: string | null;
    original_notes: string | null;
    created_at: string;
  };
};

export default function RelatedNotesWidget({ noteId, onOpenNote }: { noteId: number; onOpenNote?: (id: number) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<RelatedNote[]>([]);
  const [linkedNotes, setLinkedNotes] = useState<LinkedNote[]>([]);
  const [showLinked, setShowLinked] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [autoDiscovering, setAutoDiscovering] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/notes/${noteId}/suggestions?matchCount=5`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setNotes(data.results || []);
        }
      })
      .catch((e) => {
        if (isMounted) setError(e.message || 'Failed to load suggestions');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [noteId]);

    const fetchLinkedNotes = async () => {
      setLoadingLinks(true);
      try {
        const res = await fetch(`/api/notes/${noteId}/links`);
        if (!res.ok) throw new Error('Failed to fetch linked notes');
        const data = await res.json();
        setLinkedNotes(data.links || []);
        setShowLinked(true);
      } catch (err) {
        toast.error('Failed to load linked notes');
        console.error(err);
      } finally {
        setLoadingLinks(false);
      }
    };

    const autoDiscoverLinks = async () => {
      setAutoDiscovering(true);
      try {
        const res = await fetch(`/api/notes/${noteId}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auto_discover: true, min_similarity: 0.78 })
        });
        if (!res.ok) throw new Error('Failed to auto-discover links');
        const data = await res.json();
        toast.success(`Discovered ${data.count || 0} related notes`);
        // Refresh linked notes
        await fetchLinkedNotes();
      } catch (err) {
        toast.error('Failed to auto-discover links');
        console.error(err);
      } finally {
        setAutoDiscovering(false);
      }
    };

    const createManualLink = async (targetNoteId: number) => {
      try {
        const res = await fetch(`/api/notes/${noteId}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_note_id: targetNoteId })
        });
        if (!res.ok) {
          const data = await res.json();
          if (res.status === 409) {
            toast.info('Link already exists');
          } else {
            throw new Error(data.error || 'Failed to create link');
          }
          return;
        }
        toast.success('Note linked successfully');
        // Refresh suggestions and linked notes
        await fetchLinkedNotes();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to link note');
        console.error(err);
      }
    };

  if (loading) {
    return (
      <div className="space-y-2" aria-label="Related notes loading">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">Could not load related notes.</p>;
  }

  return (
      <div className="space-y-3" aria-label="Related notes">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Related Notes</h4>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={autoDiscoverLinks}
              disabled={autoDiscovering}
              aria-label="Auto-discover links"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {autoDiscovering ? 'Discovering...' : 'Auto-Link'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => showLinked ? setShowLinked(false) : fetchLinkedNotes()}
              disabled={loadingLinks}
              aria-label="View linked notes"
            >
              <Eye className="h-3 w-3 mr-1" />
              {showLinked ? 'Hide' : 'Linked'} ({linkedNotes.length})
            </Button>
          </div>
        </div>

        {showLinked ? (
          <div className="space-y-2">
            {loadingLinks ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : linkedNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked notes yet.</p>
            ) : (
              linkedNotes.map((link) => (
                <Card key={link.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {new Date(link.note.created_at).toLocaleString()}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          link.direction === 'outgoing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 
                          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {link.direction}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          link.created_by === 'system' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 
                          'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        }`}>
                          {link.link_type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {link.note.summary || link.note.original_notes || 'No preview'}
                      </p>
                      {link.similarity_score && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Similarity: {(link.similarity_score * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onOpenNote?.(link.note_id)} aria-label={`Open note ${link.note_id}`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related notes found.</p>
            ) : (
              notes.map((n) => (
                <Card key={n.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{new Date(n.created_at).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {n.summary || n.original_notes || 'No preview'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Similarity: {(n.similarity * 100).toFixed(0)}%</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => createManualLink(n.id)} 
                        aria-label={`Link note ${n.id}`}
                        title="Link this note"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onOpenNote?.(n.id)} 
                        aria-label={`Open note ${n.id}`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
    </div>
  );
}
