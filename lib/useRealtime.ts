/**
 * Real-time Collaboration Hook
 * 
 * Provides real-time presence tracking, comments subscription,
 * and collaborative editing features using Supabase Realtime.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Minimal shape for the current authenticated user
type CurrentUser = {
  id: string
  email?: string
  user_metadata?: { full_name?: string; avatar_url?: string }
} | null

// =====================================================
// TYPES
// =====================================================

export interface PresenceUser {
  id: string
  user_id: string
  user_email?: string
  user_name?: string
  user_avatar?: string
  status: 'viewing' | 'editing' | 'idle'
  cursor_position?: {
    x: number
    y: number
    selection?: { start: number; end: number }
  }
  last_seen: string
}

export interface Comment {
  id: string
  note_id: string
  user_id: string
  user_email?: string
  user_name?: string
  user_avatar?: string
  parent_id?: string
  content: string
  mentions?: string[]
  resolved: boolean
  created_at: string
  updated_at: string
  replies?: Comment[]
}

export interface NoteVersion {
  id: string
  note_id: string
  user_id: string
  version_number: number
  original_notes?: string
  summary?: string
  takeaways?: string[]
  actions?: { task: string; datetime?: string | null }[]
  tags?: string[]
  sentiment?: string
  change_description?: string
  created_at: string
}

// =====================================================
// PRESENCE HOOK
// =====================================================

export function usePresence(noteId: string | null) {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user)
    })
  }, [])

  // Update presence status
  const updatePresence = useCallback(
    async (
      status: 'viewing' | 'editing' | 'idle',
      cursorPosition?: { x: number; y: number; selection?: { start: number; end: number } }
    ) => {
      if (!noteId || !currentUser) return

      try {
        await supabase
          .from('presence')
          .upsert(
            {
              user_id: currentUser.id,
              note_id: noteId,
              status,
              cursor_position: cursorPosition,
              last_seen: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,note_id',
            }
          )
      } catch (error) {
        console.error('Failed to update presence:', error)
      }
    },
    [noteId, currentUser]
  )

  // Remove presence on unmount
  const removePresence = useCallback(async () => {
    if (!noteId || !currentUser) return

    try {
      await supabase
        .from('presence')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('note_id', noteId)
    } catch (error) {
      console.error('Failed to remove presence:', error)
    }
  }, [noteId, currentUser])

  // Subscribe to presence changes
  useEffect(() => {
    if (!noteId || !currentUser) return

    // Create channel
    const channel = supabase.channel(`presence:${noteId}`)

    channelRef.current = channel

    // Subscribe to presence changes
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: PresenceUser[] = []

        Object.keys(state).forEach((key) => {
          const raw = state[key] as unknown
          if (Array.isArray(raw)) {
            raw.forEach((presence) => {
              const p = presence as Partial<PresenceUser>
              if (p.user_id !== currentUser.id) {
                users.push(p as PresenceUser)
              }
            })
          }
        })

        setPresenceUsers(users)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          // Track own presence
          await channel.track({
            user_id: currentUser.id,
            user_email: currentUser.email,
            user_name: currentUser.user_metadata?.full_name || currentUser.email,
            user_avatar: currentUser.user_metadata?.avatar_url,
            status: 'viewing',
            last_seen: new Date().toISOString(),
          })
        }
      })

    // Heartbeat to keep presence alive
    heartbeatRef.current = setInterval(async () => {
      if (channel && currentUser) {
        await updatePresence('viewing')
      }
    }, 30000) // Every 30 seconds

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      removePresence()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      setIsConnected(false)
      setPresenceUsers([])
    }
  }, [noteId, currentUser, updatePresence, removePresence])

  return {
    presenceUsers,
    isConnected,
    updatePresence,
    removePresence,
  }
}

// =====================================================
// COMMENTS HOOK
// =====================================================

export function useComments(noteId: string | null) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!noteId) {
      setComments([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('comments')
        .select(
          `
          *,
          user:user_id (
            email,
            raw_user_meta_data
          )
        `
        )
        .eq('note_id', noteId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Transform and build comment tree
      type DbCommentRow = {
        id: string
        note_id: string
        user_id: string
        parent_id?: string
        content: string
        mentions?: string[]
        resolved: boolean
        created_at: string
        updated_at: string
        user?: { email?: string; raw_user_meta_data?: { full_name?: string; avatar_url?: string } }
      }
      const flatComments: Comment[] =
        (data as unknown as DbCommentRow[] | undefined)?.map((c) => ({
          id: c.id,
          note_id: c.note_id,
          user_id: c.user_id,
          user_email: c.user?.email,
          user_name: c.user?.raw_user_meta_data?.full_name,
          user_avatar: c.user?.raw_user_meta_data?.avatar_url,
          parent_id: c.parent_id,
          content: c.content,
          mentions: c.mentions,
          resolved: c.resolved,
          created_at: c.created_at,
          updated_at: c.updated_at,
        })) || []

      // Build comment tree (top-level comments with replies)
      const commentMap = new Map<string, Comment>()
      const rootComments: Comment[] = []

      flatComments.forEach((comment) => {
        commentMap.set(comment.id, { ...comment, replies: [] })
      })

      flatComments.forEach((comment) => {
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id)
          if (parent) {
            parent.replies = parent.replies || []
            parent.replies.push(commentMap.get(comment.id)!)
          }
        } else {
          rootComments.push(commentMap.get(comment.id)!)
        }
      })

      setComments(rootComments)
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setLoading(false)
    }
  }, [noteId])

  // Add comment
  const addComment = useCallback(
    async (content: string, parentId?: string, mentions?: string[]) => {
      if (!noteId) return null

      try {
        const { data: user } = await supabase.auth.getUser()
        if (!user.user) throw new Error('Not authenticated')

        const { data, error } = await supabase
          .from('comments')
          .insert({
            note_id: noteId,
            user_id: user.user.id,
            parent_id: parentId,
            content,
            mentions,
          })
          .select()
          .single()

        if (error) throw error

        // Refresh comments
        await fetchComments()

        return data
      } catch (error) {
        console.error('Failed to add comment:', error)
        return null
      }
    },
    [noteId, fetchComments]
  )

  // Update comment
  const updateComment = useCallback(
    async (commentId: string, content: string) => {
      try {
        const { error } = await supabase
          .from('comments')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', commentId)

        if (error) throw error

        await fetchComments()
      } catch (error) {
        console.error('Failed to update comment:', error)
      }
    },
    [fetchComments]
  )

  // Delete comment
  const deleteComment = useCallback(
    async (commentId: string) => {
      try {
        const { error } = await supabase.from('comments').delete().eq('id', commentId)

        if (error) throw error

        await fetchComments()
      } catch (error) {
        console.error('Failed to delete comment:', error)
      }
    },
    [fetchComments]
  )

  // Toggle resolved
  const toggleResolved = useCallback(
    async (commentId: string, resolved: boolean) => {
      try {
        const { error } = await supabase
          .from('comments')
          .update({ resolved })
          .eq('id', commentId)

        if (error) throw error

        await fetchComments()
      } catch (error) {
        console.error('Failed to toggle resolved:', error)
      }
    },
    [fetchComments]
  )

  // Subscribe to realtime updates
  useEffect(() => {
    if (!noteId) return

    fetchComments()

    // Subscribe to comment changes
    const channel = supabase
      .channel(`comments:${noteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `note_id=eq.${noteId}`,
        },
        () => {
          fetchComments()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [noteId, fetchComments])

  return {
    comments,
    loading,
    addComment,
    updateComment,
    deleteComment,
    toggleResolved,
    refresh: fetchComments,
  }
}

// =====================================================
// VERSION HISTORY HOOK
// =====================================================

export function useVersionHistory(noteId: string | null) {
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    if (!noteId) {
      setVersions([])
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('version_number', { ascending: false })

      if (error) throw error

      setVersions((data as NoteVersion[]) || [])
    } catch (error) {
      console.error('Failed to fetch versions:', error)
    } finally {
      setLoading(false)
    }
  }, [noteId])

  // Restore version
  const restoreVersion = useCallback(
    async (versionId: string) => {
      try {
        // Get version data
        const { data: version, error: versionError } = await supabase
          .from('note_versions')
          .select('*')
          .eq('id', versionId)
          .single()

        if (versionError) throw versionError

        // Update note with version data
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            original_notes: version.original_notes,
            summary: version.summary,
            takeaways: version.takeaways,
            actions: version.actions,
            tags: version.tags,
            sentiment: version.sentiment,
          })
          .eq('id', version.note_id)

        if (updateError) throw updateError

        return true
      } catch (error) {
        console.error('Failed to restore version:', error)
        return false
      }
    },
    []
  )

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  return {
    versions,
    loading,
    refresh: fetchVersions,
    restoreVersion,
  }
}
