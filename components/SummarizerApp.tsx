"use client";

import { useMemo, useRef, useEffect, useState } from 'react';
import useAsyncAction from '@/lib/useAsyncAction';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Import tất cả các components giao diện cần thiết
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Terminal, Copy, X, Volume2, VolumeX, AlertCircle, Calendar, Link, FileText, Plus } from "lucide-react";
import { useSpeech } from '@/lib/useSpeech';
import { useSummarizerStore } from '@/lib/state/summarizerStore';
import { ApiErrorMessages } from '@/lib/apiErrors';

// Import calendar utilities
import { generateCalendarLinks, downloadICS } from '@/lib/calendarLinks';

// Import components
import History from './History';
import SearchBar from './SearchBar';
import FolderSidebar from './FolderSidebar';
import WorkspaceManager from './WorkspaceManager';
import { ThemeToggle } from './theme-toggle';
import TemplateSelector from './TemplateSelector';
import { PersonaManager } from './PersonaManager';
import { useRouter } from 'next/navigation';
import VoiceInputButton from './VoiceInputButton';
import LanguageSelector from './LanguageSelector';
import EncryptionDialog from './EncryptionDialog';
import NavigationMenu from './NavigationMenu';
import NotificationCenter from './NotificationCenter';
import GuestUpgradeDialog from './GuestUpgradeDialog';
import { useKeyboardShortcuts, commonShortcuts } from '@/lib/useKeyboardShortcuts';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';
import OnboardingTour from './OnboardingTour';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Import guest mode utilities

// Định nghĩa kiểu dữ liệu cho kết quả (unused, kept for reference)
// type SummaryResult = {
//   summary: string;
//   takeaways: string[];
//   actions: ActionItem[];
//   tags?: string[];
//   sentiment?: 'positive' | 'neutral' | 'negative';
// };

// Component chính của ứng dụng
function SummarizerApp({ session, isGuestMode }: { session: Session; isGuestMode: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  
  // === State (partial migration to Zustand) ===
  const {
    notes, setNotes,
    customPersona, setCustomPersona,
    isLoading,
    result, clearResult,
    error, setUrlInput: setStoreUrlInput,
    inputMode, setInputMode,
    urlInput,
    urlError,
    isValidUrl,
    remainingUses,
    setSelectedFolderId,
    setSelectedWorkspaceId,
    submitNotes,
    submitUrl,
    setErrorState,
    setResultState: _setResultState,
    selectedWorkspaceId,
    selectedFolderId,
    urlContentSource,
  } = useSummarizerStore((s) => ({
    notes: s.notes,
    setNotes: s.setNotes,
    customPersona: s.customPersona,
    setCustomPersona: s.setCustomPersona,
    isLoading: s.isLoading,
    result: s.result,
    clearResult: s.clearResult,
    error: s.error,
    setUrlInput: s.setUrlInput,
    inputMode: s.inputMode,
    setInputMode: s.setInputMode,
    urlInput: s.urlInput,
    urlError: s.urlError,
    isValidUrl: s.isValidUrl,
    remainingUses: s.remainingUses,
    setSelectedFolderId: s.setSelectedFolderId,
    setSelectedWorkspaceId: s.setSelectedWorkspaceId,
    submitNotes: s.submitNotes,
    submitUrl: s.submitUrl,
    setErrorState: s.setErrorState,
    setResultState: s.setResultState,
    selectedWorkspaceId: s.selectedWorkspaceId,
    selectedFolderId: s.selectedFolderId,
    urlContentSource: s.urlContentSource,
  }));
  const [currentSpeaking, setCurrentSpeaking] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  const [_lastNoteId, setLastNoteId] = useState<number | null>(null);
  // Refs for focusing inputs (mobile FAB)
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const urlRef = useRef<HTMLInputElement | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Hook cho Text-to-Speech
  const { speak, stop, isSpeaking, isSupported } = useSpeech();

  // Initialize store with session/guest
  useEffect(() => {
    useSummarizerStore.setState({ session, isGuestMode });
  }, [session, isGuestMode]);

  // URL validation handled in store via setUrlInput

  // Show onboarding on first visit to the main app (skip during test runs)
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const done = localStorage.getItem('onboarding_done');
      const hasSeenOnboarding = sessionStorage.getItem('onboarding_seen_this_session');
      
      // Only show if not done AND not already seen this session
      if (!done && !hasSeenOnboarding) {
        setShowOnboarding(true);
        sessionStorage.setItem('onboarding_seen_this_session', 'true');
      }
    } catch {}
  }, []);

  // Auto-save draft for guest users
  useEffect(() => {
    if (isGuestMode && (notes || customPersona || result)) {
      sessionStorage.setItem('guestDraft', JSON.stringify({ 
        notes, 
        customPersona, 
        result,
        timestamp: Date.now()
      }));
    }
  }, [notes, customPersona, result, isGuestMode]);

  // Restore draft after sign-in
  useEffect(() => {
    if (!isGuestMode && session) {
      const draft = sessionStorage.getItem('guestDraft');
      if (draft) {
        try {
          const { notes: savedNotes, customPersona: savedPersona, timestamp } = JSON.parse(draft);
          // Only restore if draft is less than 24 hours old
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            if (savedNotes) setNotes(savedNotes);
            if (savedPersona) setCustomPersona(savedPersona);
            toast.success('Welcome back! Your draft has been restored.');
            sessionStorage.removeItem('guestDraft');
          }
        } catch (e) {
          console.error('Failed to restore draft:', e);
        }
      }
    }
     // Note: setCustomPersona and setNotes are Zustand actions and are stable
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isGuestMode]);

  // Auto-detect URLs in notes and suggest switching to URL mode
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (inputMode === 'text' && notes.trim()) {
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      const matches = notes.match(urlPattern);
      if (matches && matches.length > 0) {
        setDetectedUrl(matches[0]);
      } else {
        setDetectedUrl(null);
      }
    } else {
      setDetectedUrl(null);
    }
  }, [notes, inputMode]);

  // Embedding status polling
  const startEmbeddingPoll = async () => {
    // Try to get the last created note ID from History or localStorage
    // For simplicity, we'll check recent notes from the API
    try {
      const response = await fetch('/api/notes?limit=1');
      if (response.ok) {
        const data = await response.json();
        if (data.notes && data.notes.length > 0) {
          const noteId = data.notes[0].id;
          setLastNoteId(noteId);
          setEmbeddingStatus('pending');
          pollEmbeddingStatus(noteId);
        }
      }
    } catch (e) {
      console.error('Failed to get note ID for embedding poll', e);
    }
  };

  const pollEmbeddingStatus = (noteId: number) => {
    // Clear any existing poll
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/embedding/status/${noteId}`, { method: 'HEAD' });
        const status = response.headers.get('x-embedding-status') || 'missing';
        
        if (response.status === 204) {
          // Completed
          setEmbeddingStatus('completed');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (response.status === 424) {
          // Failed
          setEmbeddingStatus('failed');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (response.status === 102) {
          // Processing or pending
          setEmbeddingStatus(status === 'processing' ? 'processing' : 'pending');
        } else {
          // Missing or error
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (e) {
        console.error('Embedding status poll error', e);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(checkStatus, 2000);
  };

  // Cleanup polling on unmount or when result changes
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Reset embedding status when starting new summarization
  useEffect(() => {
    if (isLoading) {
      setEmbeddingStatus('idle');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [isLoading]);

  const handleSwitchToUrlMode = () => {
    if (detectedUrl) {
      setInputMode('url');
  setStoreUrlInput(detectedUrl);
      setNotes('');
      setDetectedUrl(null);
    }
  };

  // Mobile FAB: focus main input, provide light haptic feedback
  const focusPrimaryInput = () => {
    try { 
      const nav = navigator as { vibrate?: (pattern: number | number[]) => void };
      nav.vibrate?.(10); 
    } catch {}
    // Prefer text mode as default capture for quick note
    if (inputMode !== 'text') setInputMode('text');
    // Defer focus to end of frame to ensure mode switch has rendered
    requestAnimationFrame(() => {
      if (notesRef.current) {
        notesRef.current.focus();
        notesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (urlRef.current) {
        urlRef.current.focus();
        urlRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  // Hàm lấy emoji cho sentiment
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

  const getSentimentLabel = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'Positive';
      case 'negative':
        return 'Negative';
      case 'neutral':
      default:
        return 'Neutral';
    }
  };

  // Hàm tiện ích để copy text
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Normalize action item label from various shapes used in tests and API
  const getActionTask = (a: unknown): string => {
    if (!a || typeof a !== 'object') return '';
    const anyA = a as { task?: unknown; title?: unknown };
    return String(anyA.task ?? anyA.title ?? '');
  };

  // Hàm xử lý Text-to-Speech
  const handleSpeak = (text: string, section: string) => {
    if (currentSpeaking === section && isSpeaking) {
      // Nếu đang đọc section này thì dừng lại
      stop();
      setCurrentSpeaking(null);
    } else {
      // Đọc text mới
      speak(text);
      setCurrentSpeaking(section);
    }
  };

  // Hàm xử lý đăng nhập/đăng xuất
  const handleSignIn = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
    } catch (e) {
      console.error('Sign-in failed', e);
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Trang sẽ tự động reload về màn hình đăng nhập
  };

  // Hàm chính xử lý việc gọi API và lưu dữ liệu
  const { run: runSubmit, isRunning: isSubmitting } = useAsyncAction();

  const handleSubmit = async () => {
    // Route to appropriate handler based on input mode
    if (inputMode === 'url') {
      return handleUrlSubmit();
    }

    // Check guest limit
    await submitNotes();
  const { error: err, result: res } = useSummarizerStore.getState();
    if (err) {
      const friendly = ApiErrorMessages[err as keyof typeof ApiErrorMessages] || err;
      toast.error(friendly);
    } else if (res) {
      toast.success('Summary ready');
      // Skip embedding poll in test environment to avoid extra fetch complexity
      if (!isGuestMode && session && process.env.NODE_ENV !== 'test') {
        startEmbeddingPoll();
      }
    }
  };

  const handleUrlSubmit = async () => {
    // Check guest limit
    // guest limit handled in store

    // Validate URL
    if (!urlInput.trim()) {
      setErrorState("Please enter a URL");
      return;
    }

    try {
      new URL(urlInput);
    } catch {
      setErrorState("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    await submitUrl();
  const { error: err, result: res } = useSummarizerStore.getState();
    if (err) {
      const friendly = ApiErrorMessages[err as keyof typeof ApiErrorMessages] || err;
      toast.error(friendly);
    } else if (res) {
      toast.success('URL summarized');
      if (!isGuestMode && session && process.env.NODE_ENV !== 'test') {
        startEmbeddingPoll();
      }
    }
  };

  // Keyboard shortcuts
  // - Ctrl+Enter or Ctrl+S: summarize/submit (when eligible)
  // - Ctrl+N: new note (clear current input)
  // - Ctrl+P: open persona selector
  // - Ctrl+K: open search (for logged-in users)
  const submitRef = useRef(handleSubmit);
  const personaButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  const shortcuts = useMemo(() => {
    type Shortcut = { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; callback: () => void; description?: string };
    const baseShortcuts: Shortcut[] = [
      {
        key: 'Enter',
        ctrl: true,
        callback: () => {
          if (!isLoading && ((inputMode === 'text' && notes.trim()) || (inputMode === 'url' && urlInput.trim()))) {
            submitRef.current?.();
          }
        },
        description: 'Summarize',
      },
      {
        ...commonShortcuts.save,
        callback: () => {
          if (!isLoading && ((inputMode === 'text' && notes.trim()) || (inputMode === 'url' && urlInput.trim()))) {
            submitRef.current?.();
          }
        }
      },
      {
        ...commonShortcuts.newNote,
        callback: () => {
          if (inputMode === 'text') {
            setNotes('');
          } else {
            setStoreUrlInput('');
          }
          clearResult();
          setErrorState(null);
        }
      },
      {
        key: 'p',
        ctrl: true,
        callback: () => {
          personaButtonRef.current?.click();
        },
        description: 'Open persona selector'
      }
    ];

    // Add search shortcut only for logged-in users
    if (!isGuestMode && session) {
      baseShortcuts.push({
        key: 'k',
        ctrl: true,
        callback: () => {
          searchButtonRef.current?.click();
        },
        description: 'Open semantic search'
      });
    }

    // Global shortcuts dialog (Shift + ?)
    baseShortcuts.push({
      key: '/',
      shift: true,
      callback: () => setShowShortcuts(true),
      description: 'Show keyboard shortcuts'
    });

    return baseShortcuts;
    // Note: setNotes, clearResult, setErrorState, setStoreUrlInput are Zustand actions and are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, isLoading, notes, urlInput, isGuestMode, session]);
  
  useKeyboardShortcuts(shortcuts);
  
  return (
  <TooltipProvider delayDuration={200}>
   <main id="main-content" className="flex min-h-screen bg-background" data-testid="summarizer-app">
      {/* === Sidebar for Folders & Workspaces (only for logged in users) === */}
      {!isGuestMode && (
        <aside className="w-64 border-r border-border p-4 hidden lg:block space-y-6">
          {/* Workspace Selector */}
            <WorkspaceManager
              selectedWorkspaceId={selectedWorkspaceId}
              onWorkspaceChange={setSelectedWorkspaceId}
            />

          {/* Folder Sidebar */}
          <FolderSidebar 
            userId={session.user.id} 
            onFolderSelect={setSelectedFolderId}
            selectedFolderId={selectedFolderId}
          />
        </aside>
      )}

      {/* === Main Content === */}
      <div className="flex-1 flex flex-col items-center p-6 sm:p-12">
        {/* === Header === */}
        <div className="w-full max-w-5xl flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              {!isGuestMode && <NavigationMenu />}
              {/* Mobile: open Folders drawer */}
              {!isGuestMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="lg:hidden" variant="outline" onClick={() => setShowFolders(true)}>
                      {t('folders')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open folders panel</TooltipContent>
                </Tooltip>
              )}
              <span className="text-muted-foreground text-sm hidden sm:block">
            {isGuestMode ? (
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('guestMode')} ({remainingUses} {t('usesLeft')})
              </span>
            ) : (
              `Welcome, ${session.user.email}`
            )}
          </span>
            </div>
          <div className="flex items-center gap-2">
            {!isGuestMode && session && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <NotificationCenter session={session} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <div data-testid="language-selector">
                  <LanguageSelector />
                </div>
              </TooltipTrigger>
              <TooltipContent>Change language</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div data-testid="theme-toggle">
                  <ThemeToggle />
                </div>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setShowShortcuts(true)}>?
                </Button>
              </TooltipTrigger>
              <TooltipContent>Show keyboard shortcuts (Shift + ?)</TooltipContent>
            </Tooltip>
            {!isGuestMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSignOut} variant="outline">{t('signOut')}</Button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSignIn} variant="default">{t('signIn')}</Button>
                </TooltipTrigger>
                <TooltipContent>Sign in for unlimited access</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

  <div className="w-full max-w-5xl">
          <header className="text-center mb-10">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{t('smartNoteSummarizer')}</h1>
            <p className="text-muted-foreground mt-2">
              {/* Keep friendly tagline in English for now */}
              Describe an AI persona, paste your notes, and watch the magic happen.
            </p>
            {isGuestMode && (
              remainingUses <= 1 ? (
                <div className="mt-3 flex items-center justify-center gap-3 text-amber-700 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                  <span className="text-sm">You&apos;re almost out of guest summaries.</span>
                  <Button size="sm" onClick={() => setShowUpgradeDialog(true)} variant="default">
                    See What You&apos;re Missing
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      ⚠️ Limited to {remainingUses} summaries while signed out
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Sign in for unlimited access, history, folders, and more!
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowUpgradeDialog(true)}
                    className="ml-3 shrink-0"
                  >
                    Learn More
                  </Button>
                </div>
              )
            )}
          </header>

        {/* === KHU VỰC NHẬP LIỆU === */}
        <section className="mb-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('customPersona')}
            </label>
            
            {/* Persona Manager - for authenticated users */}
            {!isGuestMode && (
              <div ref={(el) => {
                if (el) {
                  const selectTrigger = el.querySelector('[role="combobox"]') as HTMLButtonElement;
                  if (selectTrigger) personaButtonRef.current = selectTrigger;
                }
              }}>
                <PersonaManager
                  currentPersona={customPersona}
                  onSelectPersona={setCustomPersona}
                  userId={session?.user?.id}
                />
              </div>
            )}
            
            <div className="flex flex-wrap gap-3 mt-2 items-start">
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  placeholder="e.g., A cynical pirate looking for treasure..."
                  className="w-full"
                  value={customPersona}
                  onChange={(e) => setCustomPersona(e.target.value)}
                />
              </div>
              <div className="shrink-0">
                <TemplateSelector
                  onSelectTemplate={(template: { persona_prompt?: string; name?: string; content?: unknown; structure?: unknown }) => {
                    const persona = template.persona_prompt || template.name || '';
                    const toMarkdown = (seed: unknown): string => {
                      const tryParse = (s: string): unknown | null => { try { return JSON.parse(s); } catch { return null; } };
                      const buildFromSections = (obj: unknown): string | null => {
                        if (!obj || typeof obj !== 'object') return null;
                        const sections = Array.isArray((obj as { sections?: unknown[] }).sections) ? (obj as { sections: unknown[] }).sections : null;
                        if (!sections) return null;
                        const lines: string[] = [];
                        sections.forEach((sec: unknown) => {
                          const secObj = sec as { title?: unknown; fields?: unknown[] };
                          const title = (secObj?.title || 'Section').toString();
                          lines.push(`## ${title}`);
                          const fields = Array.isArray(secObj?.fields) ? secObj.fields : [];
                          if (fields.length) fields.forEach((f: unknown) => lines.push(`- [ ] ${String(f)}`));
                          lines.push('');
                        });
                        return lines.join('\n');
                      };
                      if (seed && typeof seed === 'object') {
                        const md = buildFromSections(seed);
                        return md ?? '```json\n' + JSON.stringify(seed, null, 2) + '\n```';
                      }
                      if (typeof seed === 'string') {
                        const trimmed = seed.trim();
                        const obj = tryParse(trimmed);
                        if (obj) {
                          const md = buildFromSections(obj);
                          return md ?? '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
                        }
                        return trimmed;
                      }
                      return '';
                    };
                    const rawSeed = template.content ?? template.structure ?? '';
                    const markdownSeed = toMarkdown(rawSeed);
                    setCustomPersona(persona);
                    setNotes(markdownSeed);
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Input Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
              variant={inputMode === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setInputMode('text')}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Text Notes
            </Button>
              </TooltipTrigger>
              <TooltipContent>Switch to text input</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
              variant={inputMode === 'url' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setInputMode('url')}
              className="gap-2"
            >
              <Link className="h-4 w-4" />
              URL
            </Button>
              </TooltipTrigger>
              <TooltipContent>Switch to URL input</TooltipContent>
            </Tooltip>
          </div>
          
          {/* Conditional Input: Text or URL */}
          {inputMode === 'text' ? (
            <div className="space-y-3">
              <div className="relative">
         <Textarea
           placeholder={t('pasteYourNotes')}
                className="min-h-[280px] text-base p-4 w-full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                ref={notesRef}
              />
              {notes && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear notes"
                  className="absolute top-2 right-2"
                  onClick={() => setNotes("")}
                > 
                  <X className="h-4 w-4" />
                </Button>
              )}
              </div>
              
              {/* URL Detection Hint */}
              {detectedUrl && (
                <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                  <Link className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200">URL Detected</AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    <p className="mb-2">We detected a URL in your notes: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{detectedUrl.slice(0, 50)}{detectedUrl.length > 50 ? '...' : ''}</code></p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={handleSwitchToUrlMode}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Switch to URL Mode
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetectedUrl(null)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
          </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type="url"
                  placeholder="https://example.com/article"
                  className="text-base p-4 h-auto"
                  value={urlInput}
                  onChange={(e) => setStoreUrlInput(e.target.value)}
                  ref={urlRef}
                />
                {urlInput && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Clear URL"
                    className="absolute top-2 right-2"
                    onClick={() => setStoreUrlInput("")}
                  > 
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {/* Mobile Floating Action Button (FAB) */}
                <div className="md:hidden">
                  <Button
                    type="button"
                    onClick={focusPrimaryInput}
                    aria-label="New note"
                    className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                    size="icon"
                  >
                    <Plus className="h-6 w-6" />
                  </Button>
                </div>
              </div>
              
              {/* URL Preview Card */}
              {urlInput && (
                <Card className={`border-2 transition-colors ${
                  isValidUrl 
                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950' 
                    : urlError 
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950' 
                    : 'border-gray-200 dark:border-gray-800'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      {isValidUrl ? (
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                            <Link className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        {isValidUrl ? (
                          <>
                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                              Ready to summarize
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1 break-all">
                              {urlInput}
                            </p>
                            {/* YouTube hint if transcript may be missing */}
                            {(() => {
                              try {
                                const u = new URL(urlInput);
                                const host = u.hostname.toLowerCase();
                                if (host.includes('youtube.com') || host === 'youtu.be') {
                                  return (
                                    <div className="mt-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded p-2">
                                      {`YouTube video detected. We'll use the transcript if available; otherwise we'll fall back to title + description.`}
                                    </div>
                                  );
                                }
                              } catch {}
                              return null;
                            })()}
                          </>
                        ) : urlError ? (
                          <>
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                              {urlError}
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                              Please check the URL format
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <p className="text-xs text-muted-foreground">
                Enter a URL to extract and summarize its content. Works with articles, blog posts, and most web pages.
              </p>
            </div>
          )}

          {/* Voice Input & Encryption Buttons - Only for Text Mode */}
          {inputMode === 'text' && (
            <div className="flex gap-2 flex-wrap">
              <VoiceInputButton 
                onTranscript={(text) => setNotes(notes + ' ' + text)}
                className="flex-1 sm:flex-initial"
              />
              <EncryptionDialog 
                mode="encrypt"
                content={notes}
                onResult={(encrypted) => setNotes(encrypted)}
              />
              {notes.includes('"encrypted"') && (
                <EncryptionDialog 
                  mode="decrypt"
                  content={notes}
                  onResult={(decrypted) => setNotes(decrypted)}
                />
              )}
            </div>
          )}

          <Button
            size="lg"
            className="w-full text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
            onClick={() => runSubmit(() => handleSubmit())}
            disabled={isLoading || isSubmitting || (inputMode === 'text' ? !notes.trim() : (!urlInput.trim() || !isValidUrl))}
            aria-label="Summarize"
          >
            {isLoading || isSubmitting ? "Processing..." : inputMode === 'url' ? 'Summarize URL' : t('summarize')}
          </Button>
        </section>
        
        {/* === KHU VỰC HIỂN THỊ KẾT QUẢ ĐỘNG === */}
        <section className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <>
              <Card><CardHeader><CardTitle>Summary (TL;DR)</CardTitle></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-[80%]" /></CardContent></Card>
              <Card><CardHeader><CardTitle>Key Takeaways</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 mt-0.5 rounded-full" /><Skeleton className="h-5 w-full" /></div><div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 mt-0.5 rounded-full" /><Skeleton className="h-5 w-[90%]" /></div></CardContent></Card>
              <Card><CardHeader><CardTitle>Action Items</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 mt-0.5 rounded-full" /><Skeleton className="h-5 w-[70%]" /></div></CardContent></Card>
            </>
          )}

          {result && (

            <>
              {/* Fallback banner for YouTube metadata-only summaries */}
              {urlContentSource === 'youtube-metadata' && (
                <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Limited YouTube Context</AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    Transcript was unavailable. This summary is based on the video title and description only. For richer results, try a video with captions enabled.
                  </AlertDescription>
                </Alert>
              )}
              {/* Embedding Status Badge */}
              {!isGuestMode && embeddingStatus !== 'idle' && embeddingStatus !== 'completed' && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Embedding Status</AlertTitle>
                  <AlertDescription>
                    {embeddingStatus === 'pending' && 'Your note is queued for semantic search indexing...'}
                    {embeddingStatus === 'processing' && 'Generating semantic search index...'}
                    {embeddingStatus === 'failed' && 'Failed to generate semantic search index. Your note is still saved.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Accessible TTS control for the entire result */}
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const allText = [
                      result.summary,
                      ...(result.takeaways || []).map(t => `• ${t}`),
                      ...(result.actions || []).map(a => `- ${a.task}${a.datetime ? ` (${new Date(a.datetime).toLocaleString()})` : ''}`)
                    ].join('\n');
                    handleSpeak(allText, 'all');
                  }}
                  aria-label={currentSpeaking === 'all' && isSpeaking ? 'Stop reading' : 'Read aloud'}
                >
                  {currentSpeaking === 'all' && isSpeaking ? 'Stop' : 'Read aloud'}
                </Button>
                <Button
                  className="ml-2"
                  variant="outline"
                  onClick={() => {
                    try {
                      const timestamp = Date.now();
                      const summaryId = `summary-${timestamp}`;
                      
                      const nodes = [
                        {
                          id: summaryId,
                          type: 'default',
                          position: { x: 80, y: 60 },
                          data: { label: `Summary\n\n${result.summary}` },
                          style: { backgroundColor: '#ecfeff', border: '2px solid #06b6d4', borderRadius: '8px', padding: '10px', width: 360, height: 160 },
                        },
                        ...((result.takeaways || []).map((t, i) => ({
                          id: `takeaway-${i}-${timestamp}`,
                          type: 'default',
                          position: { x: 80 + (i%3)*220, y: 260 + Math.floor(i/3)*180 },
                          data: { label: `Takeaway ${i+1}: ${t}` },
                          style: { backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', padding: '10px', width: 200, height: 120 },
                        }))),
                        ...((result.actions || []).map((a, i) => ({
                          id: `action-${i}-${timestamp}`,
                          type: 'default',
                          position: { x: 760 + (i%3)*220, y: 260 + Math.floor(i/3)*180 },
                          data: { label: `Action ${i+1}: ${getActionTask(a)}` },
                          style: { backgroundColor: '#dcfce7', border: '2px solid #22c55e', borderRadius: '8px', padding: '10px', width: 220, height: 120 },
                        }))),
                      ];
                      
                      // Create edges connecting summary to takeaways and actions
                      const edges = [
                        // Connect summary to all takeaways
                        ...((result.takeaways || []).map((_, i) => ({
                          id: `e-summary-takeaway-${i}`,
                          source: summaryId,
                          target: `takeaway-${i}-${timestamp}`,
                          type: 'smoothstep',
                          animated: false,
                          style: { stroke: '#f59e0b', strokeWidth: 2 },
                        }))),
                        // Connect summary to all actions
                        ...((result.actions || []).map((_, i) => ({
                          id: `e-summary-action-${i}`,
                          source: summaryId,
                          target: `action-${i}-${timestamp}`,
                          type: 'smoothstep',
                          animated: false,
                          style: { stroke: '#22c55e', strokeWidth: 2 },
                        }))),
                      ];
                      
                      sessionStorage.setItem('canvasDraft', JSON.stringify({ title: 'Summary Canvas', nodes, edges }));
                      router.push('/canvas');
                    } catch (e) {
                      console.error('Failed to open in Canvas', e);
                    }
                  }}
                >
                  Open in Canvas
                </Button>
              </div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>{t('summary')}</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak(result.summary, 'summary')}
                        className={currentSpeaking === 'summary' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                        aria-label={currentSpeaking === 'summary' && isSpeaking ? 'Stop speaking summary' : 'Speak summary'}
                      >
                        {currentSpeaking === 'summary' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy summary"
                      onClick={() => handleCopy(result.summary)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground" data-testid="summary-text">{result.summary}</p>
                </CardContent>
              </Card>

              {/* Tags và Sentiment */}
              {(result.tags || result.sentiment) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('tags')} & {t('sentiment')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Tags */}
                    {result.tags && result.tags.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Tags:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.tags.map((tag, index) => (
                            <span
                              key={`tag-${index}`}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Sentiment */}
                    {result.sentiment && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Sentiment:</p>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">{getSentimentEmoji(result.sentiment)}</span>
                          <span className="text-lg font-medium text-foreground">
                            {getSentimentLabel(result.sentiment)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

  <Card data-testid="takeaways-card">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{t('keyTakeaways')}</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak((result.takeaways || []).join('. '), 'takeaways')}
                        className={currentSpeaking === 'takeaways' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                        aria-label={currentSpeaking === 'takeaways' && isSpeaking ? 'Stop speaking takeaways' : 'Speak takeaways'}
                      >
                        {currentSpeaking === 'takeaways' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy takeaways"
                      onClick={() => handleCopy(result.takeaways.join('\n- '))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-foreground">
                    {(result.takeaways || []).map((item, index) => (
                      <li key={`takeaway-${index}`} data-testid={`takeaway-${index}`}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

  <Card data-testid="actions-card">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{t('actionItems')}</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (result.actions || []).length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak((result.actions || []).map(a => getActionTask(a)).join('. '), 'actions')}
                        className={currentSpeaking === 'actions' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                        aria-label={currentSpeaking === 'actions' && isSpeaking ? 'Stop speaking actions' : 'Speak actions'}
                      >
                        {currentSpeaking === 'actions' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy actions"
                      onClick={() => handleCopy((result.actions || []).map(a => getActionTask(a)).join('\n- '))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(result.actions || []).length > 0 ? (
                    <ul className="list-disc list-inside space-y-2 text-foreground">
                      {(result.actions || []).map((item, index) => (
                        <li key={`action-${index}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                              <span>{getActionTask(item)}</span>
                            {item.datetime && (
                              <span className="text-xs text-muted-foreground">
                                ({new Date(item.datetime).toLocaleString()})
                              </span>
                            )}
                          </div>
                          {item.datetime && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(() => {
                                  const links = generateCalendarLinks({
                                      task: item.task || '',
                                    datetime: item.datetime,
                                    description: result.summary.slice(0, 100)
                                  });
                                  return (
                                    <>
                                      <DropdownMenuItem asChild>
                                        <a href={links.google} target="_blank" rel="noopener noreferrer">
                                          Google Calendar
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={links.outlook} target="_blank" rel="noopener noreferrer">
                                          Outlook.com
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={links.office365} target="_blank" rel="noopener noreferrer">
                                          Office 365
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={links.yahoo} target="_blank" rel="noopener noreferrer">
                                          Yahoo Calendar
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => downloadICS(
                                          getActionTask(item),
                                          item.datetime!,
                                          60,
                                          result.summary.slice(0, 100)
                                        )}
                                      >
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
                  ) : (
                    <p className="text-muted-foreground italic">No action items found.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>
        
        {/* === HIỂN THỊ LỊCH SỬ GHI CHÚ === */}
        {!isGuestMode ? (
          <History selectedFolderId={selectedFolderId} userId={session.user.id} />
        ) : (
          <History isGuest={true} />
        )}

        {/* === TÌM KIẾM THEO NGỮ NGHĨA === */}
        {!isGuestMode && (
          <div ref={(el) => {
            if (el) {
              const searchInput = el.querySelector('input[type="text"]') as HTMLInputElement;
              if (searchInput) {
                // Create a virtual button that focuses the search input
                const virtualButton = document.createElement('button');
                virtualButton.style.display = 'none';
                virtualButton.onclick = () => searchInput.focus();
                searchButtonRef.current = virtualButton;
                el.appendChild(virtualButton);
              }
            }
          }}>
            <SearchBar userId={session.user.id} />
          </div>
        )}
        </div>
      </div>
    {!isGuestMode && (
      <Dialog open={showFolders} onOpenChange={setShowFolders}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Folders</DialogTitle>
            <DialogDescription>Manage your folders and select one to filter notes.</DialogDescription>
          </DialogHeader>
          <FolderSidebar 
            userId={session.user.id}
            onFolderSelect={(id) => { setSelectedFolderId(id); setShowFolders(false); }}
            selectedFolderId={selectedFolderId}
          />
        </DialogContent>
      </Dialog>
    )}
    
    {/* Guest Upgrade Dialog */}
    {isGuestMode && (
      <GuestUpgradeDialog 
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
      />
    )}

    {/* Global dialogs */}
    <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    <OnboardingTour open={showOnboarding} onOpenChange={setShowOnboarding} isGuestMode={isGuestMode} />
    </main>
    </TooltipProvider>
  );
}

import { ErrorBoundary } from './ErrorBoundary';

export default function SummarizerAppWithBoundary(props: { session: Session; isGuestMode: boolean }) {
  return (
    <ErrorBoundary>
      <SummarizerApp {...props} />
    </ErrorBoundary>
  );
}