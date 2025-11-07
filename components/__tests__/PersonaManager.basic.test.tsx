import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonaManager } from '../PersonaManager';

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock window.confirm
const mockConfirm = jest.fn();
global.confirm = mockConfirm;

// Mock scrollIntoView (used by Radix Select)
Element.prototype.scrollIntoView = jest.fn();

describe('PersonaManager (Basic Tests)', () => {
  const mockOnSelectPersona = jest.fn();
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReturnValue(false); // Default to cancel
    
    // Mock fetch for personas list
    global.fetch = jest.fn((url) => {
      if (url === '/api/personas') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            personas: [
              {
                id: 'persona-1',
                name: 'Test Persona',
                prompt: 'Test prompt',
                description: 'Test description',
                is_default: true,
                created_at: '2024-01-01',
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    test('renders persona selector for authenticated users', async () => {
      render(
        <PersonaManager
          currentPersona=""
          onSelectPersona={mockOnSelectPersona}
          userId={mockUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    test('does not render for guest users', () => {
      render(
        <PersonaManager
          currentPersona=""
          onSelectPersona={mockOnSelectPersona}
          userId={undefined}
        />
      );

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    test('fetches personas on mount', async () => {
      render(
        <PersonaManager
          currentPersona=""
          onSelectPersona={mockOnSelectPersona}
          userId={mockUserId}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/personas');
      });
    });
  });

  describe('Save Persona Dialog', () => {
    test('opens save persona dialog', async () => {
      render(
        <PersonaManager
          currentPersona="Test prompt"
          onSelectPersona={mockOnSelectPersona}
          userId={mockUserId}
        />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Find and click the "Save Persona" button (not inside dialog)
      const buttons = screen.getAllByRole('button');
      const saveButton = buttons.find(btn => btn.textContent?.includes('Save Persona'));
      expect(saveButton).toBeDefined();
      fireEvent.click(saveButton!);

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/save current persona/i)).toBeInTheDocument();
      });
    });

    test('validates required fields when saving', async () => {
      const { toast } = require('sonner');
      
      render(
        <PersonaManager
          currentPersona="Test prompt"
          onSelectPersona={mockOnSelectPersona}
          userId={mockUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Open save dialog
      const saveButton = screen.getByRole('button', { name: /save.*persona/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Try to save without filling in name
      const saveInDialogButton = screen.getByRole('button', { name: /save persona/i });
      fireEvent.click(saveInDialogButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Name and prompt are required');
      });

      expect(global.fetch).not.toHaveBeenCalledWith('/api/personas', expect.objectContaining({
        method: 'POST',
      }));
    });

    test('saves persona successfully', async () => {
      const { toast } = require('sonner');
      
      // Mock POST response
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url === '/api/personas' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ persona: { id: 'new-persona' } }),
          });
        }
        if (url === '/api/personas') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ personas: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(
        <PersonaManager
          currentPersona="Test prompt"
          onSelectPersona={mockOnSelectPersona}
          userId={mockUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Open dialog
      const saveButton = screen.getByRole('button', { name: /save.*persona/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill in name
      const nameInput = screen.getByPlaceholderText(/professional summary, student notes/i);
      fireEvent.change(nameInput, { target: { value: 'My Custom Persona' } });

      // Save
      const saveInDialogButton = screen.getByRole('button', { name: /save persona/i });
      fireEvent.click(saveInDialogButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/personas', expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('My Custom Persona'),
        }));
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Persona saved successfully');
      });
    });
  });

  describe('Delete Persona', () => {
    test('shows manage button when personas exist', async () => {
      render(
        <PersonaManager
          currentPersona=""
          onSelectPersona={mockOnSelectPersona}
          userId={mockUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Manage button should appear since we have a persona in our mock
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^manage$/i })).toBeInTheDocument();
      });
    });
  });

  describe('Preset Personas', () => {
    test('renders persona selector', async () => {
      render(
        <PersonaManager
          currentPersona=""
          onSelectPersona={mockOnSelectPersona}
          userId={mockUserId}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Check that the select has a placeholder
      expect(screen.getByText(/select persona/i)).toBeInTheDocument();
    });
  });
});
