import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SummarizerApp from '../SummarizerApp';
import type { Session } from '@supabase/supabase-js';

// Mock Next.js App Router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
}));

// Mock i18next to return simple English translations
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        smartNoteSummarizer: 'Smart Note Summarizer',
        pasteYourNotes: 'Paste your messy notes',
        customPersona: 'Custom AI Persona (optional)',
        summarize: 'Summarize',
        summary: 'Summary',
        keyTakeaways: 'Key Takeaways',
        actionItems: 'Action Items',
        tags: 'Tags',
        sentiment: 'Sentiment',
        guestMode: 'Guest Mode',
        usesLeft: 'uses left',
        signIn: 'Sign In',
        signOut: 'Sign Out',
        folders: 'folders',
      };
      return translations[key] || key;
    },
    i18n: {
      changeLanguage: jest.fn(),
      language: 'en',
    },
  }),
}));

// Mock guestMode module
jest.mock('@/lib/guestMode', () => ({
  getRemainingUsage: jest.fn(() => 5),
  canGuestUse: jest.fn(() => true),
  incrementGuestUsage: jest.fn(),
  addGuestNote: jest.fn(),
  getGuestHistory: jest.fn(() => []),
  deleteGuestNote: jest.fn(),
}));

// Mock all child components
jest.mock('../History', () => {
  return function MockHistory() {
    return <div data-testid="history">History Component</div>;
  };
});

jest.mock('../SearchBar', () => {
  return function MockSearchBar() {
    return <div data-testid="searchbar">SearchBar Component</div>;
  };
});

jest.mock('../FolderSidebar', () => {
  return function MockFolderSidebar({ onFolderSelect }: { onFolderSelect: (id: number) => void }) {
    return (
      <div data-testid="folder-sidebar">
        <button onClick={() => onFolderSelect(1)}>Select Folder</button>
      </div>
    );
  };
});

jest.mock('../WorkspaceManager', () => {
  return function MockWorkspaceManager({ onWorkspaceChange }: { onWorkspaceChange: (id: string) => void }) {
    return (
      <div data-testid="workspace-manager">
        <button onClick={() => onWorkspaceChange('ws-1')}>Select Workspace</button>
      </div>
    );
  };
});

jest.mock('../TemplateSelector', () => {
  return function MockTemplateSelector() {
    return <div data-testid="template-selector">Template Selector</div>;
  };
});

jest.mock('../VoiceInputButton', () => {
  return function MockVoiceInputButton() {
    return <button data-testid="voice-input">Voice Input</button>;
  };
});

jest.mock('../LanguageSelector', () => {
  return function MockLanguageSelector() {
    return <div data-testid="language-selector">Language</div>;
  };
});

jest.mock('../EncryptionDialog', () => {
  return function MockEncryptionDialog() {
    return <div data-testid="encryption-dialog">Encryption</div>;
  };
});

jest.mock('../NavigationMenu', () => {
  return function MockNavigationMenu() {
    return <div data-testid="navigation-menu">Nav</div>;
  };
});

jest.mock('../theme-toggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

// Mock useSpeech hook
jest.mock('@/lib/useSpeech', () => ({
  useSpeech: () => ({
    speak: jest.fn(),
    stop: jest.fn(),
    isSpeaking: false,
    isSupported: true,
  }),
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Mock PersonaManager to avoid fetch calls during tests
jest.mock('../PersonaManager', () => ({
  PersonaManager: ({ onSelectPersona }: { onSelectPersona: (p: string) => void }) => (
    <div data-testid="persona-manager">
      <button onClick={() => onSelectPersona('Test Persona')}>Select Persona</button>
    </div>
  ),
}));

describe('SummarizerApp', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      expires_at: Date.now() + 3600,
    } as Session;

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
    
    // Reset Zustand store to initial state
    const { useSummarizerStore } = require('@/lib/state/summarizerStore');
    useSummarizerStore.setState({
      notes: '',
      customPersona: '',
      isLoading: false,
      result: null,
      error: null,
      inputMode: 'text',
      urlInput: '',
      urlError: null,
      isValidUrl: false,
      remainingUses: 5,
      selectedFolderId: null,
      selectedWorkspaceId: null,
      session: null,
      isGuestMode: false,
    });
  });

  describe('Guest Mode', () => {
    beforeEach(() => {
      const guestMode = require('@/lib/guestMode');
      guestMode.getRemainingUsage.mockReturnValue(5);
      guestMode.canGuestUse.mockReturnValue(true);
      guestMode.incrementGuestUsage.mockClear();
      guestMode.addGuestNote.mockClear();
    });

    test('displays guest mode indicator', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={true} />);
      
      expect(screen.getByText(/Guest Mode/i)).toBeInTheDocument();
      expect(screen.getByText(/5 uses left/i)).toBeInTheDocument();
    });

    test('does not show sidebar components in guest mode', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={true} />);
      
      expect(screen.queryByTestId('folder-sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workspace-manager')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigation-menu')).not.toBeInTheDocument();
    });

    test('does not show sign out button in guest mode', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={true} />);
      
      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
    });

    test('prevents submission when guest limit reached', async () => {
      const guestMode = require('@/lib/guestMode');
      guestMode.canGuestUse.mockReturnValue(false);
      
      render(<SummarizerApp session={mockSession} isGuestMode={true} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test note' } });
      
      const submitButton = screen.getByRole('button', { name: /Summarize/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/reached the guest limit/i)).toBeInTheDocument();
      });
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('submits successfully in guest mode', async () => {
      const mockResponse = {
        summary: 'Test summary',
        takeaways: ['Point 1', 'Point 2'],
        actions: [{ title: 'Task 1', priority: 'high', deadline: null }],
        tags: ['test'],
        sentiment: 'neutral',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<SummarizerApp session={mockSession} isGuestMode={true} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test note content' } });
      
      const submitButton = screen.getByRole('button', { name: /Summarize/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/summarize',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"isGuest":true'),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test summary')).toBeInTheDocument();
      });

      const guestMode = require('@/lib/guestMode');
      expect(guestMode.incrementGuestUsage).toHaveBeenCalled();
      expect(guestMode.addGuestNote).toHaveBeenCalled();
    });
  });

  describe('Authenticated Mode', () => {
    test('displays user email', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      expect(screen.getByText(/Welcome, test@example.com/i)).toBeInTheDocument();
    });

    test('shows sidebar components for authenticated users', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      expect(screen.getByTestId('folder-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-manager')).toBeInTheDocument();
      expect(screen.getByTestId('navigation-menu')).toBeInTheDocument();
    });

    test('shows sign out button', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    test('submits with user context', async () => {
      const mockResponse = {
        summary: 'Authenticated summary',
        takeaways: ['Point 1'],
        actions: [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}), // For background embedding call
        });

      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Authenticated note' } });
      
      const submitButton = screen.getByRole('button', { name: /Summarize/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/summarize',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"userId":"user-123"'),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Authenticated summary')).toBeInTheDocument();
      });
    });
  });

  describe('Input and Interaction', () => {
    test('allows text input in notes textarea', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'My test notes' } });
      
      expect(textarea).toHaveValue('My test notes');
    });

    test('allows custom persona input', () => {
      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const personaInput = screen.getByPlaceholderText(/cynical pirate/i);
      fireEvent.change(personaInput, { target: { value: 'Student' } });
      
      expect(personaInput).toHaveValue('Student');
    });

    test('disables submit button while loading', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 100))
      );

      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      
      const submitButton = screen.getByRole('button', { name: /Summarize/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(submitButton).toHaveTextContent(/Processing/i);
      });
    });
  });

  describe('Results Display', () => {
    test('displays summary result', async () => {
      const mockResponse = {
        summary: 'This is the summary',
        takeaways: ['Key point 1', 'Key point 2'],
        actions: [{ title: 'Action 1', priority: 'high', deadline: null }],
        tags: ['work', 'urgent'],
        sentiment: 'positive',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}), // For background embedding call
        });

      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test content' } });
      
      const submitButton = screen.getByRole('button', { name: /Summarize/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('This is the summary')).toBeInTheDocument();
      });
      
      // After summary appears, check detail content also available
      await waitFor(() => {
        expect(screen.getByText('Key point 1')).toBeInTheDocument();
      });
      expect(screen.getByText('Key point 2')).toBeInTheDocument();
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    test('displays sentiment indicator', async () => {
      const mockResponse = {
        summary: 'Summary',
        takeaways: [],
        actions: [],
        sentiment: 'positive',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}), // For background embedding call
        });

      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByRole('button', { name: /Summarize/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/Positive/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByRole('button', { name: /Summarize/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    test('displays error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByRole('button', { name: /Summarize/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });
  });

  describe('Copy Functionality', () => {
    test('copies text to clipboard', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      const mockResponse = {
        summary: 'Copy this summary',
        takeaways: [],
        actions: [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}), // For background embedding call
        });

      render(<SummarizerApp session={mockSession} isGuestMode={false} />);
      
      const textarea = screen.getByPlaceholderText(/Paste your messy notes/i);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: /Summarize/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Copy this summary')).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByRole('button', { name: /copy/i });
      if (copyButtons.length > 0) {
        fireEvent.click(copyButtons[0]);
        expect(mockClipboard.writeText).toHaveBeenCalled();
      }
    });
  });
});
