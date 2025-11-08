"use client";
import useAsyncAction from '@/lib/useAsyncAction';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase as defaultSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2, FolderInput, Share2, Copy, Check, Edit, Download, Tag, X, Star, Filter, Calendar, CheckSquare, Square, Volume2, VolumeX, ArrowUpDown, MessageSquare, Users, History as HistoryIcon } from 'lucide-react';
import * as guestMode from '@/lib/guestMode';
import type { GuestNote } from '@/lib/guestMode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tag = {
  id: number;
  name: string;
};

type ActionItem = {
  task: string;
  datetime?: string | null;
};

type Note = {
  id: number;
  created_at: string;
  summary: string;
  persona: string;
  sentiment?: string;
  folder_id?: number;
  is_public?: boolean;
  is_pinned?: boolean;
  share_id?: string;
  original_notes?: string;
  takeaways?: string[];
  actions?: ActionItem[];
  folders?: {
    id: number;
    name: string;
    color: string;
  };
  note_tags?: {
    tags: Tag;
  }[];
};

type Folder = {
  id: number;
  name: string;
  color: string;
};

import SearchBar from './SearchBar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/EmptyState';
import { FileQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';
import { generateCalendarLinks, downloadICS } from '@/lib/calendarLinks';
import dynamic from 'next/dynamic';
import { useSpeech } from '@/lib/useSpeech';
import { CommentThread } from '@/components/collaboration/CommentThread';
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator';
import { VersionHistory } from '@/components/collaboration/VersionHistory';
import { RealtimeCollaboration } from '@/lib/realtime/collaboration';
import type { Comment, PresenceState, NoteVersion } from '@/lib/realtime/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type HistoryProps = {
  isGuest?: boolean;
  selectedFolderId?: number | null;
  userId?: string;
  supabaseClient?: SupabaseClient;
};

// Dynamically import RelatedNotesWidget to avoid impacting tests/SSR
const RelatedNotesWidget = dynamic(() => import('./RelatedNotesWidget'), { ssr: false });

function RelatedNotesWidgetWrapper({ noteId }: { noteId: number }) {
  return <RelatedNotesWidget noteId={noteId} />;
}

function History({ isGuest = false, selectedFolderId = null, userId, supabaseClient }: HistoryProps) {
  const supabase = supabaseClient ?? defaultSupabase;
  const [notes, setNotes] = useState<Note[]>([]);
  const [guestNotes, setGuestNotes] = useState<GuestNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [moveNoteId, setMoveNoteId] = useState<number | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [copiedNoteId, setCopiedNoteId] = useState<number | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<number | string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInFolder, setSearchInFolder] = useState(false);

  // Filter states
  const [sentimentFilter, setSentimentFilter] = useState<'positive' | 'neutral' | 'negative' | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  
  // Sort state with persistence
  type SortOrder = 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'sentiment';
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    try {
      const saved = localStorage.getItem('historySortOrder');
      if (saved && ['newest', 'oldest', 'title-asc', 'title-desc', 'sentiment'].includes(saved)) {
        return saved as SortOrder;
      }
    } catch {}
    return isGuest ? 'oldest' : 'newest';
  });
  
  // Persist sort order when changed
  useEffect(() => {
    try {
      localStorage.setItem('historySortOrder', sortOrder);
    } catch {}
  }, [sortOrder]);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 4;
  const [analyzingNoteId, setAnalyzingNoteId] = useState<number | null>(null);
  // Sonner toasts are used globally via <Toaster /> in layout
  const [editNoteId, setEditNoteId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{
    original_notes: string;
    summary: string;
    takeaways: string;
    actions: string;
  }>({ original_notes: '', summary: '', takeaways: '', actions: '' });
  const [tagNoteId, setTagNoteId] = useState<number | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [showRelated, setShowRelated] = useState(false);
  const { run: runBackfill, isRunning: backfillRunning } = useAsyncAction();
  const handleBackfillEmbeddings = useCallback(async () => {
    await runBackfill(async () => {
      if (isGuest || !userId) return;
      try {
        const res = await fetch('/api/admin/backfill-embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, limit: 100 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed');
        const processed = data?.processed ?? data?.count ?? 0;
        toast.success(`Embeddings backfill queued: ${processed} notes`);
      } catch (e) {
        console.error('Backfill error', e);
        toast.error('Failed to backfill embeddings');
      }
    });
  }, [isGuest, userId, runBackfill]);
  
  // Bulk selection state
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  // Keyboard navigation state (logged-in mode)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  // TTS state
  const { speak, stop, isSpeaking, isSupported } = useSpeech();
  const [speakingNoteId, setSpeakingNoteId] = useState<number | string | null>(null);
  
    // Note details dialog state (for collaboration features)
    const [detailsNoteId, setDetailsNoteId] = useState<number | null>(null);
    const [collaboration, setCollaboration] = useState<RealtimeCollaboration | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [presence, setPresence] = useState<PresenceState[]>([]);
    const [versions, setVersions] = useState<NoteVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

  const getSentimentEmoji = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😞';
      case 'neutral':
      default:
        return '😐';
    }
  };

  // Normalize action item label from various shapes used in API/tests
  const getActionTask = (a: unknown): string => {
    if (!a || typeof a !== 'object') return '';
    const anyA = a as { task?: unknown; title?: unknown };
    return String(anyA.task ?? anyA.title ?? '');
  };

  // Helper function to check if note matches date filter
  const matchesDateFilter = useCallback((createdAt: string): boolean => {
    if (!dateFilter) return true;

    const noteDate = new Date(createdAt);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today': {
        return noteDate >= todayStart;
      }
      case 'week': {
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return noteDate >= weekAgo;
      }
      case 'month': {
        const monthAgo = new Date(todayStart);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return noteDate >= monthAgo;
      }
      default:
        return true;
    }
  }, [dateFilter]);

  useEffect(() => {
    const fetchNotes = async () => {
      if (isGuest) {
        // Guest mode: fetch from localStorage
        setGuestNotes(guestMode.getGuestHistory());
        setLoading(false);
        setHasMore(false); // No pagination for guest mode
      } else {
        // Logged in: fetch from Supabase
        setLoading(true);
        try {
          // Fetch folders
          const { data: foldersData } = await supabase
            .from('folders')
            .select('id, name, color')
            .order('name');
          setFolders(foldersData || []);

          // Build base select
          const base = supabase
            .from('notes')
            .select(`
            id, 
            created_at, 
            summary, 
            persona, 
            sentiment,
            folder_id,
            is_public,
            is_pinned,
            share_id,
            original_notes,
            takeaways,
            actions,
            folders (
              id,
              name,
              color
            ),
            note_tags (
              tags (
                id,
                name
              )
            )
            `, { count: 'exact' });

          // Apply optional folder filter, pagination, and then order
          const query = selectedFolderId !== null
            ? base.eq('folder_id', selectedFolderId)
            : base;
          
          // Apply ordering; use range when available (tests may mock without it)
          const ordered1 = query.order('is_pinned', { ascending: false });
          const canChainOrder = typeof (ordered1 as unknown as { order?: unknown }).order === 'function';
          const ordered = canChainOrder
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (ordered1 as any).order('created_at', { ascending: false })
            : ordered1;

          let data: unknown[] | null | undefined;
          let error: { message?: string } | null | undefined;
          let count: number | null | undefined;
          const maybeHasRange = typeof (ordered as unknown as { range?: unknown }).range === 'function';
          if (maybeHasRange) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const res = await (ordered as any).range(0, PAGE_SIZE - 1);
            data = res?.data;
            error = res?.error;
            count = res?.count;
          } else {
            const res = await ordered as unknown as { data?: unknown[]; error?: { message?: string } | null };
            data = res?.data;
            error = res?.error;
            count = data ? data.length : 0;
          }

          if (error) {
            console.error("Error fetching notes:", error);
            // Hide Load More on error
            setHasMore(false);
          } else {
            const list = (data || []) as unknown as Note[];
            setNotes(list);
            // Only show Load More when we actually have more to fetch
            const total = (count as number | null | undefined) ?? (list.length || 0);
            setTotalCount(total);
            setHasMore(total > PAGE_SIZE);
            setPage(1);
          }
        } catch (e) {
          console.error('Error in fetchNotes:', e);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchNotes();
    // supabase is a stable dependency from the prop default and does not change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, selectedFolderId]);

  // Recompute focus when filters change or notes update
  useEffect(() => {
    setFocusedIndex(null);
  }, [filterQuery, sentimentFilter, dateFilter, selectedTagFilter, isGuest]);

  // Fetch specific page (1-based)
  const fetchPage = useCallback(async (targetPage: number) => {
    if (isGuest || isLoadingMore) return;
    setIsLoadingMore(true);
    const from = (targetPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const base = supabase
        .from('notes')
        .select(`
          id,
          created_at,
          summary,
          persona,
          sentiment,
          folder_id,
          is_public,
          is_pinned,
          share_id,
          original_notes,
          takeaways,
          actions,
          folders (
            id,
            name,
            color
          ),
          note_tags (
            tags (
              id,
              name
            )
          )
        `, { count: 'exact' });

      const query = selectedFolderId !== null ? base.eq('folder_id', selectedFolderId) : base;
      const ordered1 = query.order('is_pinned', { ascending: false });
      const canChainOrder = typeof (ordered1 as unknown as { order?: unknown }).order === 'function';
      const ordered = canChainOrder
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (ordered1 as any).order('created_at', { ascending: false })
        : ordered1;

      let pageData: unknown[] | null | undefined;
      let error: { message?: string } | null | undefined;
      let count: number | null | undefined;
      const maybeHasRange = typeof (ordered as unknown as { range?: unknown }).range === 'function';
      if (maybeHasRange) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (ordered as any).range(from, to);
        pageData = res?.data;
        error = res?.error;
        count = res?.count;
      } else {
        // Fallback: fetch all and slice client-side (used in tests/mocks)
        const res = await ordered as unknown as { data?: unknown[]; error?: { message?: string } | null };
        const all = res?.data || [];
        pageData = all.slice(from, to + 1);
        error = res?.error;
        count = all.length;
      }

      if (error) {
        console.error('Error fetching page:', error);
        toast.error('Failed to change page');
      } else {
        const list = (pageData || []) as unknown as Note[];
        setNotes(list);
        const total = (count as number | null | undefined) ?? list.length;
        setTotalCount(total);
        setHasMore(targetPage * PAGE_SIZE < total);
        setPage(targetPage);
        // Reset selection/focus on page change
        setSelectedNoteIds(new Set());
        setFocusedIndex(null);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [PAGE_SIZE, isGuest, isLoadingMore, selectedFolderId, supabase]);

  // Load more notes (next page)
  const loadMore = async () => {
    if (isGuest || !hasMore || isLoadingMore) return;
    await fetchPage(page + 1);
  };

  // Delete note (invoked after confirmation)
  const confirmDelete = async () => {
    if (!deleteNoteId && deleteNoteId !== 0) return;
    const id = deleteNoteId as number | string;
    
    try {
      if (isGuest) {
        // Optimistic update for guest
        const originalNotes = guestNotes;
        setGuestNotes(guestNotes.filter(n => n.id !== id));
        toast.success('Note deleted');
        
        try {
          guestMode.deleteGuestNote(id as string);
        } catch (_e) {
          // Revert on error
          setGuestNotes(originalNotes);
          toast.error('Failed to delete note');
        }
      } else {
        // Optimistic update for logged-in user
        const originalNotes = notes;
        setNotes(notes.filter(n => n.id !== id));
        toast.success('Note deleted');
        
        try {
          const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id);
          
          if (error) {
            // Revert on error
            setNotes(originalNotes);
            toast.error('Failed to delete note');
          }
        } catch (_e) {
          // Revert on error
          setNotes(originalNotes);
          toast.error('Failed to delete note');
        }
      }
    } finally {
      setDeleteNoteId(null);
    }
  };

  // Move note to folder
  const handleMoveToFolder = async () => {
    if (!moveNoteId || !selectedFolder) return;

    const folderId = selectedFolder === "none" ? null : parseInt(selectedFolder);

    // Optimistic update
    const originalNotes = notes;
    const targetFolder = folders.find(f => f.id === folderId);
    
    setNotes(notes.map(n => {
      if (n.id === moveNoteId) {
        return {
          ...n,
          folder_id: folderId ?? undefined,
          folders: targetFolder
        };
      }
      return n;
    }));
    
    setMoveNoteId(null);
    setSelectedFolder("");
    toast.success('Note moved');

    try {
      const { error } = await supabase
        .from('notes')
        .update({ folder_id: folderId })
        .eq('id', moveNoteId);

      if (error) {
        // Revert on error
        setNotes(originalNotes);
        toast.error('Failed to move note');
        return;
      }

      // Refresh to get accurate folder data
      await refreshOneNote(moveNoteId);
    } catch (e) {
      console.error('Move error:', e);
      // Revert on error
      setNotes(originalNotes);
      toast.error('Failed to move note');
    }
  };

  // Share note (toggle public)

  // Refresh a single note with relations
  const refreshOneNote = async (noteId: number) => {
    const { data, error } = await supabase
      .from('notes')
      .select(`
        id, 
        created_at, 
        summary, 
        persona, 
        sentiment,
        folder_id,
        is_public,
        is_pinned,
        share_id,
        original_notes,
        takeaways,
        actions,
        folders (
          id,
          name,
          color
        ),
        note_tags (
          tags (
            id,
            name
          )
        )
      `)
      .eq('id', noteId)
      .single();
    if (!error && data) {
      setNotes(prev => prev.map(n => (n.id === noteId ? (data as unknown as Note) : n)));
    }
  };

  // Analyze note to regenerate tags & sentiment
  const handleAnalyze = async (noteId: number) => {
    try {
      setAnalyzingNoteId(noteId);
      const res = await fetch(`/api/notes/${noteId}/analyze`, { method: 'POST' });
      if (!res.ok) {
        console.error('Failed to analyze note');
        toast.error('Analyze failed. Please try again.');
        return;
      }
      await refreshOneNote(noteId);
      toast.success('Analysis complete. Tags & sentiment updated.');
    } catch (e) {
      console.error('Analyze error:', e);
      toast.error('Analyze failed due to a network error.');
    } finally {
      setAnalyzingNoteId(null);
    }
  };

  // Toggle public sharing
  const handleToggleShare = async (noteId: number, currentIsPublic: boolean) => {
    try {
      const res = await fetch(`/api/notes/${noteId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !currentIsPublic }),
      });
      if (!res.ok) {
        console.error('Failed to toggle share');
        return;
      }
      const { note } = await res.json();
      setNotes(notes.map(n => n.id === noteId ? { ...n, is_public: note.is_public, share_id: note.share_id } : n));
      toast.success(note.is_public ? 'Sharing enabled' : 'Sharing disabled');
    } catch (e) {
      console.error('Error toggling share:', e);
    }
  };

  // Copy share link
  const handleCopyShareLink = async (noteId: number, shareId: string) => {
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedNoteId(noteId);
    setTimeout(() => setCopiedNoteId(null), 2000);
    toast.success('Share link copied');
  };

  // Toggle pin/favorite
  const handleTogglePin = useCallback(async (noteId: number, currentIsPinned: boolean) => {
    // Optimistic UI update
    setNotes(prev => {
      const updated = prev.map(n => n.id === noteId ? { ...n, is_pinned: !currentIsPinned } : n);
      updated.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return updated;
    });
    toast.success(!currentIsPinned ? 'Note pinned' : 'Note unpinned');
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !currentIsPinned }),
      });
      if (!res.ok) {
        toast.error('Failed to toggle pin');
        // Revert optimistic update
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: currentIsPinned } : n));
        return;
      }
      const { note } = await res.json();
      // Finalize state from server
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: note.is_pinned } : n));
    } catch (e) {
      console.error('Error toggling pin:', e);
      toast.error('Failed to toggle pin');
      // Revert optimistic update
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: currentIsPinned } : n));
    }
  }, []);

  // Open edit dialog
  const handleOpenEdit = (note: Note) => {
    setEditNoteId(note.id);
    setEditFormData({
      original_notes: note.original_notes || '',
      summary: note.summary || '',
      takeaways: (note.takeaways || []).join('\n'),
      actions: (note.actions || []).map((a) => a.task || '').join('\n'),
    });
  };

  // Save edited note
  const handleSaveEdit = async () => {
    if (!editNoteId) return;
    try {
      const takeawaysArray = editFormData.takeaways.split('\n').filter(t => t.trim());
      const actionsArray = editFormData.actions.split('\n').filter(a => a.trim()).map(task => ({ task }));
      
      const res = await fetch(`/api/notes/${editNoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_notes: editFormData.original_notes,
          summary: editFormData.summary,
          takeaways: takeawaysArray,
          actions: actionsArray,
        }),
      });
      
      if (!res.ok) {
        toast.error('Failed to save changes');
        return;
      }
    } catch (e) {
      console.error('Edit error:', e);
      toast.error('Failed to save changes');
    }
    // Refresh the updated note and close the dialog
    await refreshOneNote(editNoteId);
    toast.success('Changes saved');
    setEditNoteId(null);
  };

  // Export a single note as .txt or .md
  const handleExportNote = (note: Note, format: 'txt' | 'md') => {
    const takeawaysText = (note.takeaways || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
    const actionsText = (note.actions || []).map((a, i) => `${i + 1}. ${a.task || ''}`).join('\n');
    let content = '';
    if (format === 'md') {
      content = `# ${note.summary}\n\n`;
      content += `**Created:** ${new Date(note.created_at).toLocaleString()}\n\n`;
      if (note.persona) content += `**Persona:** ${note.persona}\n\n`;
      if (note.original_notes) content += `## Original Notes\n\n${note.original_notes}\n\n`;
      content += `## Summary\n\n${note.summary}\n\n`;
      if (takeawaysText) content += `## Key Takeaways\n\n${takeawaysText}\n\n`;
      if (actionsText) content += `## Action Items\n\n${actionsText}\n\n`;
      if (note.note_tags && note.note_tags.length > 0) {
        content += `## Tags\n\n${note.note_tags.map(nt => `#${nt.tags.name}`).join(' ')}\n`;
      }
    } else {
      content = `${note.summary}\n\n`;
      content += `Created: ${new Date(note.created_at).toLocaleString()}\n`;
      if (note.persona) content += `Persona: ${note.persona}\n`;
      content += `\n---\n\n`;
      if (note.original_notes) content += `ORIGINAL NOTES:\n${note.original_notes}\n\n`;
      content += `SUMMARY:\n${note.summary}\n\n`;
      if (takeawaysText) content += `KEY TAKEAWAYS:\n${takeawaysText}\n\n`;
      if (actionsText) content += `ACTION ITEMS:\n${actionsText}\n\n`;
      if (note.note_tags && note.note_tags.length > 0) {
        content += `TAGS: ${note.note_tags.map(nt => nt.tags.name).join(', ')}\n`;
      }
    }
    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `note-${note.id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch tag suggestions
  const fetchTagSuggestions = async (query: string) => {
    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const { tags } = await res.json();
        setTagSuggestions(tags || []);
      }
    } catch (e) {
      console.error('Failed to fetch tags:', e);
    }
  };

  // Add tag to note
  const handleAddTag = async (noteId: number) => {
    const tagName = newTagInput.trim();
    if (!tagName) return;

    // Optimistic update: add a temporary tag locally immediately
    const tempId = -Date.now();
    const originalNotes = notes;
    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        const existing = n.note_tags || [];
        return {
          ...n,
          note_tags: [...existing, { tags: { id: tempId as unknown as number, name: tagName } }]
        };
      }
      return n;
    }));

    // Clear UI inputs immediately for snappy UX
    setNewTagInput('');
    setTagSuggestions([]);
    toast.success('Tag added');

    try {
      const res = await fetch(`/api/notes/${noteId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagName }),
      });

      if (!res.ok) {
        // Revert optimistic update
        setNotes(originalNotes);
        toast.error('Failed to add tag');
        return;
      }

      // Refresh from server to get canonical IDs and relations
      await refreshOneNote(noteId);
      toast.success('Tag synced');
    } catch (e) {
      console.error('Add tag error:', e);
      setNotes(originalNotes);
      toast.error('Failed to add tag');
    }
  };

  // Add tag to note by explicit name (used for recommended tags)
  const handleAddTagByName = async (noteId: number, name: string) => {
    const tagName = name.trim();
    if (!tagName) return;

    // Optimistic update
    const tempId = -Date.now();
    const originalNotes = notes;
    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        const existing = n.note_tags || [];
        // Avoid duplicate chip visually if it already exists
        const exists = existing.some(nt => (nt.tags?.name || '').toLowerCase() === tagName.toLowerCase());
        return exists ? n : {
          ...n,
          note_tags: [...existing, { tags: { id: tempId as unknown as number, name: tagName } }]
        };
      }
      return n;
    }));

    toast.success('Tag added');

    try {
      const res = await fetch(`/api/notes/${noteId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagName }),
      });

      if (!res.ok) {
        setNotes(originalNotes);
        toast.error('Failed to add tag');
        return;
      }

      await refreshOneNote(noteId);
      toast.success('Tag synced');
    } catch (_e) {
      console.error('Add tag (recommended) error');
      setNotes(originalNotes);
      toast.error('Failed to add tag');
    }
  };

  // Remove tag from note
  const handleRemoveTag = async (noteId: number, tagId: number) => {
    // Optimistic removal
    const originalNotes = notes;
    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        return {
          ...n,
          note_tags: (n.note_tags || []).filter(nt => nt.tags?.id !== tagId)
        };
      }
      return n;
    }));

    toast.success('Tag removed');

    try {
      const res = await fetch(`/api/notes/${noteId}/tags?tagId=${tagId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        setNotes(originalNotes);
        toast.error('Failed to remove tag');
        return;
      }

      // Refresh to ensure canonical state
      await refreshOneNote(noteId);
      toast.success('Tag removal synced');
    } catch (e) {
      console.error('Remove tag error:', e);
      setNotes(originalNotes);
      toast.error('Failed to remove tag');
    }
  };

  // Bulk selection handlers
  const toggleNoteSelection = (noteId: number) => {
    const newSelection = new Set(selectedNoteIds);
    if (newSelection.has(noteId)) {
      newSelection.delete(noteId);
    } else {
      newSelection.add(noteId);
    }
    setSelectedNoteIds(newSelection);
  };

  const selectAllNotes = () => {
    const filteredNotes = notes.filter(n => {
      const q = filterQuery.trim().toLowerCase();
      if (q && !(
        n.summary.toLowerCase().includes(q) ||
        (n.persona || '').toLowerCase().includes(q) ||
        (n.note_tags || []).some(nt => (nt.tags?.name || '').toLowerCase().includes(q))
      )) return false;
      if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
      if (!matchesDateFilter(n.created_at)) return false;
      if (selectedTagFilter && !(n.note_tags || []).some(nt => nt.tags?.name === selectedTagFilter)) return false;
      return true;
    });
    setSelectedNoteIds(new Set(filteredNotes.map(n => n.id)));
  };

  const deselectAllNotes = () => {
    setSelectedNoteIds(new Set());
  };

  // Highlight helper for filter query matches
  const highlightText = (text: string) => {
    const q = filterQuery.trim();
    if (!q) return text;
    try {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escaped})`, 'ig'));
      return parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 text-inherit px-0.5 rounded-sm">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    } catch {
      return text;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNoteIds.size === 0) return;
    
    if (!window.confirm(`Delete ${selectedNoteIds.size} note(s)?`)) return;

    // Optimistic: remove notes locally first for instant feedback
    const ids = Array.from(selectedNoteIds);
    const originalNotes = notes;
    let undoTimeout: NodeJS.Timeout | null = null;
    let hasCommitted = false;

    setNotes(prev => prev.filter(n => !selectedNoteIds.has(n.id)));
    setSelectedNoteIds(new Set());
    setBulkActionMode(false);

    // Show toast with undo action
    toast.success(`${ids.length} note(s) deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          if (!hasCommitted) {
            // Cancel the delete and restore
            if (undoTimeout) clearTimeout(undoTimeout);
            setNotes(originalNotes);
            toast.info('Delete cancelled');
          } else {
            toast.error('Cannot undo - delete already committed');
          }
        },
      },
      duration: 5000,
    });

    // Delay actual delete to allow undo
    undoTimeout = setTimeout(async () => {
      hasCommitted = true;
      try {
        const { error } = await supabase
          .from('notes')
          .delete()
          .in('id', ids);

        if (error) {
          // Revert on error
          setNotes(originalNotes);
          toast.error('Failed to delete notes');
        }
      } catch (e) {
        console.error('Bulk delete error:', e);
        setNotes(originalNotes);
        toast.error('Failed to delete notes');
      }
    }, 5000);
  };

  const handleBulkMove = async (targetFolderId: string) => {
    if (selectedNoteIds.size === 0) return;

    // Optimistic move: update UI immediately
    const ids = Array.from(selectedNoteIds);
    const folderId = targetFolderId === 'none' ? null : parseInt(targetFolderId);
    const originalNotes = notes;
    const targetFolder = folders.find(f => f.id === folderId) || undefined;
    let undoTimeout: NodeJS.Timeout | null = null;
    let hasCommitted = false;

    setNotes(prev => prev.map(n => {
      if (ids.includes(n.id)) {
        return {
          ...n,
          folder_id: folderId ?? undefined,
          folders: folderId ? targetFolder : undefined,
        };
      }
      return n;
    }));

    setSelectedNoteIds(new Set());
    setBulkActionMode(false);

    const folderName = targetFolder?.name || 'No folder';
    toast.success(`${ids.length} note(s) moved to ${folderName}`, {
      action: {
        label: 'Undo',
        onClick: () => {
          if (!hasCommitted) {
            // Cancel the move and restore
            if (undoTimeout) clearTimeout(undoTimeout);
            setNotes(originalNotes);
            toast.info('Move cancelled');
          } else {
            toast.error('Cannot undo - move already committed');
          }
        },
      },
      duration: 5000,
    });

    // Delay actual move to allow undo
    undoTimeout = setTimeout(async () => {
      hasCommitted = true;
      try {
        const { error } = await supabase
          .from('notes')
          .update({ folder_id: folderId })
          .in('id', ids);

        if (error) {
          setNotes(originalNotes);
          toast.error('Failed to move notes');
          return;
        }

        // Optionally refresh affected notes
        await Promise.all(ids.map(id => refreshOneNote(id)));
      } catch (e) {
        console.error('Bulk move error:', e);
        setNotes(originalNotes);
        toast.error('Failed to move notes');
      }
    }, 5000);
  };

  const handleBulkExport = () => {
    if (selectedNoteIds.size === 0) return;

    const selectedNotes = notes.filter(n => selectedNoteIds.has(n.id));
    let exportContent = '';

    selectedNotes.forEach((note, index) => {
      if (index > 0) exportContent += '\n\n---\n\n';
      exportContent += `# ${note.summary}\n\n`;
      exportContent += `Created: ${new Date(note.created_at).toLocaleString()}\n`;
      if (note.persona) exportContent += `Persona: ${note.persona}\n`;
      if (note.sentiment) exportContent += `Sentiment: ${note.sentiment}\n`;
      exportContent += `\n`;
      if (note.original_notes) exportContent += `## Original Notes\n${note.original_notes}\n\n`;
      if (note.takeaways && Array.isArray(note.takeaways)) {
        exportContent += `## Takeaways\n`;
        note.takeaways.forEach(t => exportContent += `- ${t}\n`);
        exportContent += `\n`;
      }
      if (note.actions && Array.isArray(note.actions)) {
        exportContent += `## Actions\n`;
        note.actions.forEach((a: ActionItem) => {
          exportContent += `- ${a.task}`;
          if (a.datetime) exportContent += ` (${a.datetime})`;
          exportContent += `\n`;
        });
      }
    });

    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-export-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`${selectedNoteIds.size} note(s) exported`);
  };

    // Collaboration handlers
    const handleOpenDetails = async (noteId: number) => {
      if (isGuest) {
        toast.info('Collaboration features require sign-in');
        return;
      }
    
      setDetailsNoteId(noteId);
    
      // Initialize real-time collaboration
      const collab = new RealtimeCollaboration(supabase, String(noteId));
      setCollaboration(collab);
    
      // Fetch existing comments first
      const { data: existingComments } = await collab.getComments();
      if (existingComments) {
        setComments(existingComments as Comment[]);
      }
    
      // Subscribe to comments
      await collab.subscribeToComments((comment) => {
        setComments(prev => {
          const exists = prev.find(c => c.id === comment.id);
          if (exists) {
            return prev.map(c => c.id === comment.id ? comment : c);
          }
          return [...prev, comment];
        });
      });
    
      // Subscribe to presence
      await collab.subscribeToPresence((presenceList) => {
        setPresence(presenceList);
      });
    
      // Join presence
      const user = await supabase.auth.getUser();
      if (user.data.user) {
        await collab.joinPresence({
          name: user.data.user.email || 'Anonymous',
          status: 'viewing',
        });
      }
    
      // Load version history
      setLoadingVersions(true);
      const { data: versionsData } = await collab.getVersionHistory();
      if (versionsData) {
        setVersions(versionsData);
      }
      setLoadingVersions(false);
    };
  
    const handleCloseDetails = async () => {
      try {
        if (collaboration) {
          // Best-effort leave presence and cleanup; don't block UI if these fail
          try {
            await collaboration.leavePresence();
          } catch (e) {
            console.warn('leavePresence failed', e);
          }
          try {
            await collaboration.cleanup();
          } catch (e) {
            console.warn('cleanup failed', e);
          }
        }
      } finally {
        // Always reset local UI state so the dialog can close promptly
        setDetailsNoteId(null);
        setCollaboration(null);
        // Preserve comments so they remain visible immediately on reopen; they'll be refreshed on mount
        setPresence([]);
        setVersions([]);
      }
    };
  
    const handleAddComment = async (data: { content: string; parent_id?: number; mentions: string[] }) => {
        if (!collaboration) return { data: null, error: { message: 'Not connected' } };

        const result = await collaboration.addComment(data);
        if (result.error) {
          toast.error('Failed to add comment');
          return result;
        }

        // Optimistically append the newly created comment so UI updates immediately
        if (result.data) {
          const newComment = result.data as Comment;
          setComments(prev => {
            // Avoid duplicate if subscription already provided it
            const exists = prev.find(c => c.id === newComment.id);
            if (exists) return prev;
            return [...prev, newComment];
          });
        }

        toast.success('Comment added');
        return result;
  };

  const handleResolve = async (commentId: number) => {
    if (!collaboration) return;
  
    const result = await collaboration.resolveComment(commentId);
    if (result.error) {
      toast.error('Failed to resolve comment');
    } else {
      toast.success('Comment resolved');
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, resolved: true } : c
      ));
    }
  };    const handleRestoreVersion = async (versionId: number) => {
      if (!collaboration) return;
    
      const result = await collaboration.restoreVersion(versionId);
      if (result.error) {
        toast.error('Failed to restore version');
      } else {
        toast.success('Version restored successfully');
        // Refresh the note
        if (detailsNoteId) {
          await refreshOneNote(detailsNoteId);
        }
        // Reload version history
        const { data: versionsData } = await collaboration.getVersionHistory();
        if (versionsData) {
          setVersions(versionsData);
        }
      }
    };

  // Derived filtered lists for rendering and keyboard nav
  const filteredGuestNotes = useMemo(() => {
    if (!isGuest) return [] as GuestNote[];
    const q = filterQuery.trim().toLowerCase();
    return guestNotes.filter(n => {
      if (q && !(
        n.summary.toLowerCase().includes(q) ||
        (n.persona || '').toLowerCase().includes(q) ||
        (n.tags || []).some(t => (t || '').toLowerCase().includes(q))
      )) return false;
      if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
      if (!matchesDateFilter(n.created_at)) return false;
      if (selectedTagFilter && !(n.tags || []).includes(selectedTagFilter)) return false;
      return true;
    });
  }, [guestNotes, isGuest, filterQuery, sentimentFilter, selectedTagFilter, matchesDateFilter]);

  const filteredNotes = useMemo(() => {
    if (isGuest) return [] as Note[];
    const q = filterQuery.trim().toLowerCase();
    return notes.filter(n => {
      if (q && !(
        n.summary.toLowerCase().includes(q) ||
        (n.persona || '').toLowerCase().includes(q) ||
        (n.note_tags || []).some(nt => (nt.tags?.name || '').toLowerCase().includes(q))
      )) return false;
      if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
      if (!matchesDateFilter(n.created_at)) return false;
      if (selectedTagFilter && !(n.note_tags || []).some(nt => nt.tags?.name === selectedTagFilter)) return false;
      return true;
    });
  }, [notes, isGuest, filterQuery, sentimentFilter, selectedTagFilter, matchesDateFilter]);

  // Sorted lists based on sortOrder
  const sortedGuestNotes = useMemo(() => {
    const arr = [...filteredGuestNotes];
    const sentimentRank = (s?: string) => (s === 'positive' ? 2 : s === 'neutral' ? 1 : s === 'negative' ? 0 : -1);
    arr.sort((a, b) => {
      switch (sortOrder) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title-asc':
          return a.summary.localeCompare(b.summary);
        case 'title-desc':
          return b.summary.localeCompare(a.summary);
        case 'sentiment':
          return sentimentRank(b.sentiment) - sentimentRank(a.sentiment);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return arr;
  }, [filteredGuestNotes, sortOrder]);

  const sortedNotes = useMemo(() => {
    const sentimentRank = (s?: string) => (s === 'positive' ? 2 : s === 'neutral' ? 1 : s === 'negative' ? 0 : -1);
    const cmp = (a: Note, b: Note) => {
      switch (sortOrder) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title-asc':
          return a.summary.localeCompare(b.summary);
        case 'title-desc':
          return b.summary.localeCompare(a.summary);
        case 'sentiment':
          return sentimentRank(b.sentiment) - sentimentRank(a.sentiment);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    };
    // Keep pinned notes first, but apply sorting within each group
    const pinned = filteredNotes.filter(n => n.is_pinned);
    const others = filteredNotes.filter(n => !n.is_pinned);
    pinned.sort(cmp);
    others.sort(cmp);
    return [...pinned, ...others];
  }, [filteredNotes, sortOrder]);

  const scrollFocusedIntoView = (index: number | null) => {
    if (index == null) return;
    const items = document.querySelectorAll<HTMLElement>('.history-note-card');
    const el = items.item(index);
    el?.scrollIntoView({ block: 'nearest' });
  };

  // Keyboard shortcuts (logged-in mode only) — uses the shared hook contract
  const shortcuts = useMemo(() => {
    return [
      {
        key: 'j',
        description: 'Next note',
        callback: () => {
          if (isGuest || filteredNotes.length === 0) return;
          setBulkActionMode(false);
          setFocusedIndex(prev => {
            const next = prev == null ? 0 : Math.min(prev + 1, filteredNotes.length - 1);
            queueMicrotask(() => scrollFocusedIntoView(next));
            return next;
          });
        },
      },
      {
        key: 'k',
        description: 'Previous note',
        callback: () => {
          if (isGuest || filteredNotes.length === 0) return;
          setBulkActionMode(false);
          setFocusedIndex(prev => {
            const next = prev == null ? 0 : Math.max(prev - 1, 0);
            queueMicrotask(() => scrollFocusedIntoView(next));
            return next;
          });
        },
      },
      {
        key: 'Enter',
        description: 'Open edit',
        callback: () => {
          if (isGuest || focusedIndex == null) return;
          const note = filteredNotes[focusedIndex];
          if (note) handleOpenEdit(note);
        },
      },
      {
        key: 'e',
        description: 'Edit note',
        callback: () => {
          if (isGuest || focusedIndex == null) return;
          const note = filteredNotes[focusedIndex];
          if (note) handleOpenEdit(note);
        },
      },
      {
        key: 'p',
        description: 'Pin/unpin',
        callback: () => {
          if (isGuest || focusedIndex == null) return;
          const note = filteredNotes[focusedIndex];
          if (note) void handleTogglePin(note.id, note.is_pinned || false);
        },
      },
      {
        key: 'Delete',
        description: 'Delete note',
        callback: () => {
          if (isGuest || focusedIndex == null) return;
          const note = filteredNotes[focusedIndex];
          if (note) setDeleteNoteId(note.id);
        },
      },
      {
        key: 'Backspace',
        description: 'Delete note',
        callback: () => {
          if (isGuest || focusedIndex == null) return;
          const note = filteredNotes[focusedIndex];
          if (note) setDeleteNoteId(note.id);
        },
      },
      {
        key: '?',
        shift: true,
        description: 'Show shortcuts',
        callback: () => setShortcutsHelpOpen(true),
      },
    ];
  }, [filteredNotes, focusedIndex, isGuest, handleTogglePin]);
  useKeyboardShortcuts(shortcuts);

  if (loading) {
    return (
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">History</h2>
        <Skeleton className="w-full h-24 mb-4" />
        <Skeleton className="w-full h-24" />
      </div>
    );
  }
  
  return (
    <div className="mt-10 relative">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl font-bold text-foreground">
            History{selectedFolderId !== null && !isGuest ? ' (Filtered)' : ''}
          </h2>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by keyword..."
              value={filterQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterQuery(e.target.value)}
              className="w-full sm:w-64"
            />
            {!isGuest && userId && (
              <Button variant="outline" onClick={() => setIsSearchOpen(true)} aria-label="Open semantic search">
                Semantic Search
              </Button>
            )}
          </div>
        </div>
        
        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2">
          {/* Sentiment Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Sentiment: {sentimentFilter ? (sentimentFilter === 'positive' ? '😊 Positive' : sentimentFilter === 'negative' ? '😞 Negative' : '😐 Neutral') : 'All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSentimentFilter(null)}>
                All Sentiments
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSentimentFilter('positive')}>
                😊 Positive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSentimentFilter('neutral')}>
                😐 Neutral
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSentimentFilter('negative')}>
                😞 Negative
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Range Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Date: {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Last 7 days' : dateFilter === 'month' ? 'Last month' : 'All time'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setDateFilter(null)}>
                All time
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter('today')}>
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter('week')}>
                Last 7 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter('month')}>
                Last month
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort: {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : sortOrder === 'title-asc' ? 'Title A–Z' : sortOrder === 'title-desc' ? 'Title Z–A' : 'Sentiment'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortOrder('newest')}>
                Newest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('oldest')}>
                Oldest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('title-asc')}>
                Title A–Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('title-desc')}>
                Title Z–A
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('sentiment')}>
                Sentiment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Selected Tag Filter Display */}
          {selectedTagFilter && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedTagFilter(null)}
              className="gap-2"
            >
              Tag: {selectedTagFilter}
              <X className="h-3 w-3" />
            </Button>
          )}
          
          {/* Clear All Filters */}
          {(sentimentFilter || dateFilter || selectedTagFilter) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setSentimentFilter(null);
                setDateFilter(null);
                setSelectedTagFilter(null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        
        {/* Bulk Actions Bar (Logged in only) */}
        {!isGuest && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button
              variant={bulkActionMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setBulkActionMode(!bulkActionMode);
                if (bulkActionMode) setSelectedNoteIds(new Set());
              }}
            >
              {bulkActionMode ? 'Exit Bulk Mode' : 'Select Multiple'}
            </Button>
            
            {bulkActionMode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllNotes}
                  disabled={notes.length === 0}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllNotes}
                  disabled={selectedNoteIds.size === 0}
                >
                  Deselect All
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedNoteIds.size} selected
                </span>
                
                {selectedNoteIds.size > 0 && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete ({selectedNoteIds.size})
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <FolderInput className="h-4 w-4 mr-2" />
                          Move to...
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleBulkMove('none')}>
                          No Folder
                        </DropdownMenuItem>
                        {folders.map(folder => (
                          <DropdownMenuItem key={folder.id} onClick={() => handleBulkMove(folder.id.toString())}>
                            <span style={{ color: folder.color }}>●</span> {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExport}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export ({selectedNoteIds.size})
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {isGuest ? (
          // Guest mode
          (sortedGuestNotes.length > 0) ? (
            sortedGuestNotes.map(note => (
               <Card key={note.id} className="history-note-card" data-testid="note-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{highlightText(note.summary)}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created on {new Date(note.created_at).toLocaleDateString()}
                        {note.persona && ` using persona: "${note.persona}"`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {note.sentiment && (
                        <>
                          <span className="text-2xl" title={note.sentiment}>
                            {getSentimentEmoji(note.sentiment)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border
                              ${note.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
                                : note.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'}`}
                            aria-label={`Sentiment ${note.sentiment}`}
                          >
                            {note.sentiment}
                          </span>
                        </>
                      )}
                      {isSupported && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (speakingNoteId === note.id && isSpeaking) {
                              stop();
                              setSpeakingNoteId(null);
                            } else {
                              speak(note.summary);
                              setSpeakingNoteId(note.id);
                            }
                          }}
                          title="Speak summary"
                          aria-label="Speak summary"
                        >
                          {speakingNoteId === note.id && isSpeaking ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteNoteId(note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {note.tags.map((tag, index) => (
                        <span
                          key={`${note.id}-tag-${index}`}
                          onClick={() => setSelectedTagFilter(tag)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            selectedTagFilter === tag
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                          }`}
                          title={`Filter by ${tag}`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Items (Guest) */}
                  {note.actions && Array.isArray(note.actions) && note.actions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Action Items</p>
                      <ul className="space-y-1">
                        {note.actions.map((a, i) => (
                          <li key={`${note.id}-a-${i}`} className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{getActionTask(a)}</span>
                              {a.datetime && (
                                <span className="text-xs text-muted-foreground">({new Date(a.datetime).toLocaleString()})</span>
                              )}
                            </div>
                            {a.datetime && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Add to Calendar">
                                    <Calendar className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(() => {
                                    const links = generateCalendarLinks({
                                      task: getActionTask(a),
                                      datetime: a.datetime!,
                                      description: note.summary.slice(0, 100)
                                    });
                                    return (
                                      <>
                                        <DropdownMenuItem asChild>
                                          <a href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <a href={links.outlook} target="_blank" rel="noopener noreferrer">Outlook.com</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <a href={links.office365} target="_blank" rel="noopener noreferrer">Office 365</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <a href={links.yahoo} target="_blank" rel="noopener noreferrer">Yahoo Calendar</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => downloadICS(getActionTask(a), a.datetime!, 60, note.summary.slice(0, 100))}>
                                          Download ICS
                                        </DropdownMenuItem>
                                      </>
                                    );
                                  })()}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={FileQuestion}
              title="No notes yet"
              description="Summaries you create will appear here."
            />
          )
        ) : (
          // Logged in mode
          (sortedNotes.length > 0) ? (
            sortedNotes.map((note, index) => (
              <Card 
                key={note.id} 
                 className={`history-note-card ${bulkActionMode && selectedNoteIds.has(note.id) ? 'ring-2 ring-primary' : ''} ${!bulkActionMode && focusedIndex === index ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                 data-testid="note-card"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('noteId', String(note.id));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                style={{ cursor: 'grab' }}
                aria-selected={!bulkActionMode && focusedIndex === index}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {bulkActionMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleNoteSelection(note.id)}
                          aria-label={selectedNoteIds.has(note.id) ? 'Deselect note' : 'Select note'}
                        >
                          {selectedNoteIds.has(note.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </Button>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">{highlightText(note.summary)}</CardTitle>
                          {note.folders && (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                              style={{
                                backgroundColor: note.folders.color + '20',
                                color: note.folders.color,
                                border: `1px solid ${note.folders.color}40`
                              }}
                            >
                              {note.folders.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created on {new Date(note.created_at).toLocaleDateString()}
                          {note.persona && ` using persona: "${note.persona}"`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {note.sentiment && (
                        <>
                          <span className="text-2xl" title={note.sentiment}>
                            {getSentimentEmoji(note.sentiment)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border
                              ${note.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
                                : note.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'}`}
                            aria-label={`Sentiment ${note.sentiment}`}
                          >
                            {note.sentiment}
                          </span>
                        </>
                      )}
                      {isSupported && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (speakingNoteId === note.id && isSpeaking) {
                              stop();
                              setSpeakingNoteId(null);
                            } else {
                              speak(note.summary);
                              setSpeakingNoteId(note.id);
                            }
                          }}
                          title="Speak summary"
                          aria-label="Speak summary"
                        >
                          {speakingNoteId === note.id && isSpeaking ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnalyze(note.id)}
                        disabled={analyzingNoteId === note.id}
                        aria-label="Analyze note"
                        title="Regenerate tags and sentiment"
                      >
                        {analyzingNoteId === note.id ? 'Analyzing…' : 'Analyze'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                         onClick={() => handleOpenDetails(note.id)}
                         title="View details & collaborate"
                         aria-label="View details & collaborate"
                       >
                         <MessageSquare className="h-4 w-4" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="icon"
                        onClick={() => setTagNoteId(note.id)}
                        title="Manage tags"
                        aria-label="Manage tags"
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(note)}
                        title="Edit note"
                        aria-label="Edit note"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          const menu = document.createElement('div');
                          menu.style.cssText = 'position:fixed;background:white;border:1px solid #ccc;border-radius:4px;padding:8px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
                          menu.innerHTML = `
                            <button onclick="this.parentElement.remove();window.exportNote(${note.id},'txt')" style="display:block;width:100%;padding:8px;text-align:left;border:none;background:none;cursor:pointer">Export as .txt</button>
                            <button onclick="this.parentElement.remove();window.exportNote(${note.id},'md')" style="display:block;width:100%;padding:8px;text-align:left;border:none;background:none;cursor:pointer">Export as .md</button>
                          `;
                          document.body.appendChild(menu);
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          menu.style.left = rect.left + 'px';
                          menu.style.top = (rect.bottom + 4) + 'px';
                            (window as Window & { exportNote?: (id: number, format: 'txt' | 'md') => void }).exportNote = (id: number, format: 'txt' | 'md') => handleExportNote(note, format);
                        }}
                        title="Export note"
                        aria-label="Export note"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setMoveNoteId(note.id);
                          setSelectedFolder(note.folder_id?.toString() || "none");
                        }}
                        title="Move to folder"
                        aria-label="Move to folder"
                      >
                        <FolderInput className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={note.is_pinned ? "default" : "ghost"}
                        size="icon"
                        onClick={() => handleTogglePin(note.id, note.is_pinned || false)}
                        title={note.is_pinned ? "Unpin note" : "Pin note"}
                        aria-label={note.is_pinned ? "Unpin note" : "Pin note"}
                        className={note.is_pinned ? "text-yellow-500" : ""}
                      >
                        <Star className={`h-4 w-4 ${note.is_pinned ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        variant={note.is_public ? "default" : "ghost"}
                        size="icon"
                        onClick={() => handleToggleShare(note.id, note.is_public || false)}
                        title={note.is_public ? "Make private" : "Make public"}
                        aria-label={note.is_public ? "Make private" : "Make public"}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {note.is_public && (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 ml-1">Public</span>
                      )}
                      {note.is_public && note.share_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyShareLink(note.id, note.share_id!)}
                          title="Copy share link"
                          aria-label="Copy share link"
                        >
                          {copiedNoteId === note.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteNoteId(note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Tags */}
                  {note.note_tags && note.note_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {note.note_tags.map((noteTag, index) => (
                        <span
                          key={`${note.id}-tag-${index}`}
                          onClick={() => setSelectedTagFilter(noteTag.tags.name)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            selectedTagFilter === noteTag.tags.name
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                          }`}
                          title={`Filter by ${noteTag.tags.name}`}
                        >
                          {noteTag.tags.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Items (Logged-in) */}
                  {note.actions && Array.isArray(note.actions) && note.actions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Action Items</p>
                      <ul className="space-y-1">
                        {note.actions.map((a, i) => (
                          <li key={`${note.id}-a-${i}`} className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{getActionTask(a)}</span>
                              {a.datetime && (
                                <span className="text-xs text-muted-foreground">({new Date(a.datetime).toLocaleString()})</span>
                              )}
                            </div>
                            {a.datetime && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Add to Calendar">
                                    <Calendar className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(() => {
                                    const links = generateCalendarLinks({
                                      task: getActionTask(a),
                                      datetime: a.datetime!,
                                      description: note.summary.slice(0, 100)
                                    });
                                    return (
                                      <>
                                        <DropdownMenuItem asChild>
                                          <a href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <a href={links.outlook} target="_blank" rel="noopener noreferrer">Outlook.com</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <a href={links.office365} target="_blank" rel="noopener noreferrer">Office 365</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <a href={links.yahoo} target="_blank" rel="noopener noreferrer">Yahoo Calendar</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => downloadICS(getActionTask(a), a.datetime!, 60, note.summary.slice(0, 100))}>
                                          Download ICS
                                        </DropdownMenuItem>
                                      </>
                                    );
                                  })()}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={FileQuestion}
              title="No notes yet"
              description="Create your first summary to see it here."
            />
          )
        )}
        
        {/* Pagination Controls */}
        {!isGuest && !loading && notes.length > 0 && (
          <div className="flex items-center justify-between pt-4 gap-4 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))} • Showing {notes.length} of {totalCount}
            </div>
            <div className="flex items-center gap-2">
              {!!userId && (
                <Button variant="outline" size="sm" onClick={handleBackfillEmbeddings} disabled={backfillRunning} title="Backfill missing embeddings for your notes">
                  Backfill Embeddings
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || isLoadingMore}
                onClick={() => {
                  if (page > 1) {
                    fetchPage(page - 1);
                  }
                }}
              >
                Prev
              </Button>
              {/* Numbered pagination buttons */}
              {Array.from({ length: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) })
                .slice(0, 200) // guard against absurd counts
                .map((_, idx) => {
                  const p = idx + 1;
                  const isCurrent = p === page;
                  // Show first, last, and a window around current
                  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
                  const inWindow = p === 1 || p === totalPages || Math.abs(p - page) <= 2;
                  if (!inWindow) return null;
                  return (
                    <Button
                      key={p}
                      variant={isCurrent ? 'default' : 'outline'}
                      size="sm"
                      disabled={isCurrent || isLoadingMore}
                      onClick={() => fetchPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || isLoadingMore}
                onClick={() => loadMore()}
              >
                {isLoadingMore ? 'Loading…' : 'Next'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Move to Folder Dialog */}
      <Dialog open={moveNoteId !== null} onOpenChange={() => setMoveNoteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Choose a folder for this note
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Select folder..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">📂 No Folder</SelectItem>
              {folders.map(folder => (
                <SelectItem key={folder.id} value={folder.id.toString()}>
                  <span style={{ color: folder.color }}>📁</span> {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveNoteId(null)}>
              Cancel
            </Button>
            <Button onClick={handleMoveToFolder}>
              Move Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteNoteId !== null} onOpenChange={() => setDeleteNoteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete this note?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNoteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

            {/* Semantic Search Dialog */}
      {!isGuest && userId && (
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Semantic Search</DialogTitle>
              <DialogDescription>
             Search your notes by meaning. Try queries like &ldquo;urgent tasks&rdquo; or &ldquo;meeting with Alice&rdquo;.
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="search-in-folder"
                  type="checkbox"
                  checked={searchInFolder}
                  onChange={(e) => setSearchInFolder(e.target.checked)}
                />
                <label htmlFor="search-in-folder" className="text-sm">
                  Search in selected folder{selectedFolderId != null ? ` (#${selectedFolderId})` : ''}
                </label>
              </div>
              <SearchBar userId={userId} folderId={searchInFolder ? selectedFolderId ?? null : null} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Note Dialog */}
      <Dialog open={editNoteId !== null} onOpenChange={() => setEditNoteId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Make changes to your note content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Original Notes</label>
              <Textarea
                value={editFormData.original_notes}
                onChange={(e) => setEditFormData({ ...editFormData, original_notes: e.target.value })}
                className="mt-1 min-h-[100px]"
                placeholder="Your original notes..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Summary</label>
              <Textarea
                value={editFormData.summary}
                onChange={(e) => setEditFormData({ ...editFormData, summary: e.target.value })}
                className="mt-1 min-h-[80px]"
                placeholder="Summary..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Key Takeaways (one per line)</label>
              <Textarea
                value={editFormData.takeaways}
                onChange={(e) => setEditFormData({ ...editFormData, takeaways: e.target.value })}
                className="mt-1 min-h-[100px]"
                placeholder="Takeaway 1&#10;Takeaway 2&#10;..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Action Items (one per line)</label>
              <Textarea
                value={editFormData.actions}
                onChange={(e) => setEditFormData({ ...editFormData, actions: e.target.value })}
                className="mt-1 min-h-[100px]"
                placeholder="Action 1&#10;Action 2&#10;..."
              />
            </div>
            {/* Related Notes (Phase 4) */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Discover Related Notes</label>
                <Button variant="ghost" size="sm" onClick={() => setShowRelated(v => !v)} aria-label="Toggle related notes">
                  {showRelated ? 'Hide' : 'Show'}
                </Button>
              </div>
              {showRelated && editNoteId !== null && (
                // Lazy import to avoid SSR issues
                <RelatedNotesWidgetWrapper noteId={editNoteId} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNoteId(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog open={tagNoteId !== null} onOpenChange={() => { setTagNoteId(null); setNewTagInput(''); setTagSuggestions([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Add or remove tags for this note
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Suggested Tags (from similar notes) */}
            {tagNoteId && (
              <SuggestedTagsSection
                noteId={tagNoteId}
                existing={(notes.find(n => n.id === tagNoteId)?.note_tags || []).map(nt => nt.tags?.name || '')}
                onPick={(name) => handleAddTagByName(tagNoteId, name)}
              />
            )}
            {/* Existing tags */}
            {tagNoteId && notes.find(n => n.id === tagNoteId)?.note_tags && (
              <div>
                <label className="text-sm font-medium">Current Tags</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(notes.find(n => n.id === tagNoteId)?.note_tags || []).map((nt) => (
                    <span
                      key={nt.tags.id}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                    >
                      {nt.tags.name}
                      <button
                        onClick={() => handleRemoveTag(tagNoteId!, nt.tags.id)}
                        className="hover:text-red-600 dark:hover:text-red-400"
                        aria-label={`Remove tag ${nt.tags.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Add new tag */}
            <div>
              <label className="text-sm font-medium">Add New Tag</label>
              <div className="relative mt-1">
                <Input
                  value={newTagInput}
                  onChange={(e) => {
                    setNewTagInput(e.target.value);
                    if (e.target.value.trim()) {
                      fetchTagSuggestions(e.target.value);
                    } else {
                      setTagSuggestions([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagInput.trim() && tagNoteId) {
                      e.preventDefault();
                      handleAddTag(tagNoteId);
                    }
                  }}
                  placeholder="Type tag name..."
                  className="w-full"
                />
                {tagSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-auto">
                    {tagSuggestions.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          setNewTagInput(tag.name);
                          setTagSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => tagNoteId && handleAddTag(tagNoteId)}
                className="mt-2 w-full"
                disabled={!newTagInput.trim()}
              >
                Add Tag
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTagNoteId(null); setNewTagInput(''); setTagSuggestions([]); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sonner toasts are rendered globally via <Toaster /> */}

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Speed up navigating and managing your notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>J</span><span>Next note</span>
            </div>
            <div className="flex items-center justify-between">
              <span>K</span><span>Previous note</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Enter</span><span>Open edit</span>
            </div>
            <div className="flex items-center justify-between">
              <span>E</span><span>Edit note</span>
            </div>
            <div className="flex items-center justify-between">
              <span>P</span><span>Pin/unpin note</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delete</span><span>Delete note</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span>Shift + ?</span><span>Show this help</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShortcutsHelpOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Note Details & Collaboration Dialog */}
       <Dialog open={!!detailsNoteId} onOpenChange={(open) => !open && handleCloseDetails()}>
         <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
           <DialogHeader>
             <DialogTitle>Note Details & Collaboration</DialogTitle>
             <DialogDescription>
               View comments, team presence, and version history for this note.
             </DialogDescription>
           </DialogHeader>
           <Tabs defaultValue="comments" className="flex-1 overflow-hidden flex flex-col">
             <TabsList className="grid w-full grid-cols-3">
               <TabsTrigger value="comments" className="flex items-center gap-2">
                 <MessageSquare className="h-4 w-4" />
                 Comments {comments.length > 0 && `(${comments.length})`}
               </TabsTrigger>
               <TabsTrigger value="presence" className="flex items-center gap-2">
                 <Users className="h-4 w-4" />
                 Team {presence.length > 0 && `(${presence.length})`}
               </TabsTrigger>
               <TabsTrigger value="history" className="flex items-center gap-2">
                 <HistoryIcon className="h-4 w-4" />
                 History {versions.length > 0 && `(${versions.length})`}
               </TabsTrigger>
             </TabsList>
             <TabsContent value="comments" className="flex-1 overflow-auto mt-4">
               {detailsNoteId && (
                 <CommentThread
                   comments={comments}
                   onAddComment={handleAddComment}
                   onResolve={handleResolve}
                   currentUserId={userId || ''}
                 />
               )}
             </TabsContent>
             <TabsContent value="presence" className="flex-1 overflow-auto mt-4">
               <PresenceIndicator
                 presence={presence}
               />
             </TabsContent>
             <TabsContent value="history" className="flex-1 overflow-auto mt-4">
               {detailsNoteId && (
                 <VersionHistory
                   versions={versions}
                   currentVersion={versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) : 1}
                   onRestore={handleRestoreVersion}
                   loading={loadingVersions}
                 />
               )}
             </TabsContent>
           </Tabs>
           <DialogFooter>
             <Button variant="outline" onClick={handleCloseDetails}>
               Close
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}

function SuggestedTagsSection({
  noteId,
  existing,
  onPick,
}: {
  noteId: number;
  existing: string[];
  onPick: (name: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; score: number }[]>([]);

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/notes/${noteId}/suggested-tags?limit=6`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load suggested tags');
        }
        const data = await res.json();
        if (canceled) return;
        const list = (data.suggestions || []) as Array<{ name: string; score: number }>;
        // Filter out any tag already on the note (case-insensitive)
        const existingSet = new Set(existing.map((e) => e.toLowerCase()));
        setSuggestions(list.filter(s => !existingSet.has((s.name || '').toLowerCase())));
      } catch (_e) {
        if (canceled) return;
        setError('Could not fetch suggestions');
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    run();
    return () => { canceled = true; };
  }, [noteId, existing]);

  if (loading) {
    return (
      <div>
        <label className="text-sm font-medium">Suggested Tags</label>
        <div className="mt-2 text-xs text-muted-foreground">Loading suggestions…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <label className="text-sm font-medium">Suggested Tags</label>
        <div className="mt-2 text-xs text-destructive">{error}</div>
      </div>
    );
  }

  if (!suggestions.length) return null;

  return (
    <div>
      <label className="text-sm font-medium">Suggested Tags</label>
      <div className="flex flex-wrap gap-2 mt-2">
        {suggestions.map((s) => (
          <Button
            key={s.name}
            variant="secondary"
            size="sm"
            onClick={() => onPick(s.name)}
            aria-label={`Add tag ${s.name}`}
          >
            + {s.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

import { ErrorBoundary } from './ErrorBoundary';

export default function HistoryWithBoundary(props: HistoryProps) {
  return (
    <ErrorBoundary>
      <History {...props} />
    </ErrorBoundary>
  );
}
;

