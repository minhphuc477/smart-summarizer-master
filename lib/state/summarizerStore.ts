import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';
import { canGuestUse, incrementGuestUsage, addGuestNote, getRemainingUsage, ActionItem } from '@/lib/guestMode';

export type SummaryResult = {
  summary: string;
  takeaways: string[];
  actions: ActionItem[];
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
};

interface SummarizerState {
  notes: string;
  customPersona: string;
  isLoading: boolean;
  result: SummaryResult | null;
  error: string | null;
  inputMode: 'text' | 'url';
  urlInput: string;
  urlError: string | null;
  isValidUrl: boolean;
  urlContentSource: 'webpage' | 'youtube-transcript' | 'youtube-metadata' | null;
  remainingUses: number;
  selectedFolderId: number | null;
  selectedWorkspaceId: string | null;
  session: Session | null;
  isGuestMode: boolean;
  setSession: (s: Session | null) => void;
  setGuestMode: (g: boolean) => void;
  setNotes: (v: string) => void;
  setCustomPersona: (v: string) => void;
  setInputMode: (m: 'text' | 'url') => void;
  setUrlInput: (v: string) => void;
  setSelectedFolderId: (id: number | null) => void;
  setSelectedWorkspaceId: (id: string | null) => void;
  submitNotes: () => Promise<void>;
  submitUrl: () => Promise<void>;
  clearResult: () => void;
  setErrorState: (msg: string | null) => void;
  setResultState: (res: SummaryResult | null) => void;
  setUrlContentSource: (src: 'webpage' | 'youtube-transcript' | 'youtube-metadata' | null) => void;
}

export const useSummarizerStore = create<SummarizerState>()(
  persist(
    (set, get) => ({
  notes: '',
  customPersona: '',
  isLoading: false,
  result: null,
  error: null,
  inputMode: 'text',
  urlInput: '',
  urlError: null,
  isValidUrl: false,
  urlContentSource: null,
  remainingUses: 5,
  selectedFolderId: null,
  selectedWorkspaceId: null,
  session: null,
  isGuestMode: false,

  setSession: (s) => set({ session: s }),
  setGuestMode: (g) => set({ isGuestMode: g, remainingUses: g ? getRemainingUsage() : 0 }),
  setNotes: (v) => set({ notes: typeof v === 'string' ? v : '' }),
  setCustomPersona: (v) => set({ customPersona: v }),
  setInputMode: (m) => set({ inputMode: m }),
  setUrlInput: (v) => {
    // basic URL validation
    let urlError: string | null = null;
    let isValidUrl = false;
    if (v.trim()) {
      try {
        const parsed = new URL(v);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          isValidUrl = true;
        } else {
          urlError = 'URL must start with http:// or https://';
        }
      } catch {
        urlError = 'Please enter a valid URL';
      }
    }
    set({ urlInput: v, urlError, isValidUrl });
  },
  setSelectedFolderId: (id) => {
    set({ selectedFolderId: id });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (id === null) {
        localStorage.removeItem('selectedFolderId');
      } else {
        localStorage.setItem('selectedFolderId', String(id));
      }
    }
  },
  setSelectedWorkspaceId: (id) => {
    set({ selectedWorkspaceId: id });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (id === null) {
        localStorage.removeItem('selectedWorkspaceId');
      } else {
        localStorage.setItem('selectedWorkspaceId', id);
      }
    }
  },
  clearResult: () => set({ result: null }),
  setErrorState: (msg) => set({ error: msg }),
  setResultState: (res) => set({ result: res }),
  setUrlContentSource: (src) => set({ urlContentSource: src }),

  submitNotes: async () => {
    const { notes, customPersona, isGuestMode, session, selectedFolderId, selectedWorkspaceId } = get();
    
    // Defensive check: ensure notes is a string
    if (!notes || typeof notes !== 'string' || !notes.trim()) {
      console.warn('submitNotes called with invalid notes:', typeof notes, notes);
      return;
    }
    
    if (isGuestMode && !canGuestUse()) {
      set({ error: "You've reached the guest limit. Please sign in to continue!" });
      return;
    }
    if (notes.includes('"encrypted"') && notes.includes('"ciphertext"')) {
      set({ error: 'Your notes appear to be encrypted. Please decrypt them before summarizing.' });
      return;
    }
    set({ isLoading: true, result: null, error: null });
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          customPersona,
          isGuest: isGuestMode,
          userId: session?.user.id,
          folderId: selectedFolderId,
          workspaceId: selectedWorkspaceId,
        }),
      });
      if (!response.ok) {
        // Friendly generic error message for failed summarize
        throw new Error('Something went wrong');
      }
    const data: SummaryResult = await response.json();
    // Optimistically clear loading so UI updates immediately for tests and users
    set({ result: data, urlContentSource: null, isLoading: false });
      if (isGuestMode) {
        incrementGuestUsage();
        addGuestNote({
          original_notes: notes,
          persona: customPersona || null,
          summary: data.summary,
          takeaways: data.takeaways,
          actions: data.actions,
          tags: data.tags,
          sentiment: data.sentiment,
        });
        set({ remainingUses: getRemainingUsage() });
      }
      } catch (_e: unknown) {
        set({ error: 'Something went wrong' });
    } finally {
      set({ isLoading: false });
    }
  },

  submitUrl: async () => {
    const { urlInput, customPersona, isGuestMode, session, selectedFolderId, selectedWorkspaceId, isValidUrl } = get();
    if (!urlInput.trim()) return;
    if (!isValidUrl) {
      set({ error: 'Please enter a valid URL' });
      return;
    }
    if (isGuestMode && !canGuestUse()) {
      set({ error: "You've reached the guest limit. Please sign in to continue!" });
      return;
    }
    set({ isLoading: true, result: null, error: null });
    try {
      const response = await fetch('/api/summarize-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput, customPersona }),
      });
      if (!response.ok) {
        // Friendly generic error message for failed URL summarize
        throw new Error('Something went wrong');
      }
      const data: SummaryResult = await response.json();
      const srcHeader = response.headers.get('x-content-source') as 'webpage' | 'youtube-transcript' | 'youtube-metadata' | null;
  set({ result: data, urlContentSource: srcHeader, isLoading: false });
      if (isGuestMode) {
        incrementGuestUsage();
        addGuestNote({
          original_notes: `URL: ${urlInput}`,
          persona: customPersona || null,
          summary: data.summary,
          takeaways: data.takeaways,
          actions: data.actions,
          tags: data.tags,
          sentiment: data.sentiment,
        });
        set({ remainingUses: getRemainingUsage() });
      } else {
        // Persist summarized URL content
        // Persist summarized URL as a note; embedding auto-triggered server-side
        await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: `URL: ${urlInput}\n\nContent extracted and summarized.`,
            customPersona,
            userId: session?.user.id,
            folderId: selectedFolderId,
            workspaceId: selectedWorkspaceId,
          }),
        }).catch(() => {});
      }
      } catch (_e: unknown) {
        set({ error: 'Something went wrong' });
    } finally {
      set({ isLoading: false });
    }
  },
    }),
    {
      name: 'summarizer-storage',
      version: 1, // Increment this if you need to invalidate old storage
      partialize: (state) => ({
        selectedWorkspaceId: state.selectedWorkspaceId,
        selectedFolderId: state.selectedFolderId,
        customPersona: state.customPersona,
      }),
      // Migration function for handling version upgrades
      migrate: (persistedState: unknown, version: number) => {
        // If migrating from version 0 to 1, ensure all fields are properly typed
        if (version === 0) {
          const state = persistedState as Record<string, unknown>;
          return {
            selectedWorkspaceId: typeof state?.selectedWorkspaceId === 'string' ? state.selectedWorkspaceId : null,
            selectedFolderId: typeof state?.selectedFolderId === 'number' ? state.selectedFolderId : null,
            customPersona: typeof state?.customPersona === 'string' ? state.customPersona : '',
          };
        }
        return persistedState as Partial<SummarizerState>;
      },
      // Ensure loaded state has proper types
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SummarizerState> & { notes?: unknown };
        return {
          ...currentState,
          ...persisted,
          // Always ensure notes is a string
          notes: typeof persisted?.notes === 'string' ? persisted.notes : '',
        };
      },
    }
  )
);
