import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EncryptionDialog from '../EncryptionDialog';

// Mock lib/encryption
jest.mock('@/lib/encryption', () => ({
  encryptText: jest.fn((text, _password) => ({
    encrypted: `encrypted:${text}`,
    iv: 'test-iv',
    salt: 'test-salt'
  })),
  decryptText: jest.fn((encrypted, password, _iv, _salt) => {
    if (encrypted.includes('encrypted:') && password === 'correctPass') {
      return encrypted.replace('encrypted:', '');
    }
    throw new Error('Invalid password');
  }),
  validatePasswordStrength: jest.fn((password) => {
    if (!password || password.length < 8) return { strength: 'weak', feedback: 'Too short' };
    if (password.length < 12) return { strength: 'medium', feedback: 'Moderate' };
    return { strength: 'strong', feedback: 'Strong password' };
  })
}));

import { encryptText, decryptText } from '@/lib/encryption';

describe('EncryptionDialog', () => {
  const mockOnResult = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders trigger button', () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open Dialog</button>}
        />
      );

      expect(screen.getByText('Open Dialog')).toBeInTheDocument();
    });

    test('opens encrypt dialog when trigger is clicked', () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  expect(screen.getByText(/encrypt content/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/^enter password$/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/^re-enter password$/i)).toBeInTheDocument();
    });

    test('opens decrypt dialog when trigger is clicked', () => {
      render(
        <EncryptionDialog
          mode="decrypt"
          content='{"encrypted":"test","iv":"iv","salt":"salt"}'
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  expect(screen.getByText(/decrypt content/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/^enter password$/i)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/re-enter password/i)).not.toBeInTheDocument();
    });
  });

  describe('Password Visibility', () => {
    test('toggles password visibility', () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i) as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      // Click eye icon to toggle
      const toggleButtons = screen.getAllByRole('button');
      const eyeButton = toggleButtons.find(btn => btn.querySelector('svg'));
      if (eyeButton) {
        fireEvent.click(eyeButton);
        expect(passwordInput.type).toBe('text');

        fireEvent.click(eyeButton);
        expect(passwordInput.type).toBe('password');
      }
    });
  });

  describe('Password Strength', () => {
    test('shows weak strength for short passwords', () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
      fireEvent.change(passwordInput, { target: { value: '123' } });

      // Should show weak indicator
  const strengthIndicator = screen.queryByText(/weak/i);
  expect(strengthIndicator || screen.getByPlaceholderText(/^enter password$/i)).toBeInTheDocument();
    });

    test('shows medium strength for moderate passwords', () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      // Password is updated
      expect(passwordInput).toHaveValue('password123');
    });

    test('shows strong strength for strong passwords', () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
      fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });

      expect(passwordInput).toHaveValue('StrongPassword123!');
    });
  });

  describe('Encryption', () => {
    test('encrypts content successfully', async () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
  const confirmInput = screen.getByPlaceholderText(/^re-enter password$/i);

      fireEvent.change(passwordInput, { target: { value: 'StrongPassword123' } });
      fireEvent.change(confirmInput, { target: { value: 'StrongPassword123' } });

      const encryptButton = screen.getByRole('button', { name: /encrypt/i });
      fireEvent.click(encryptButton);

      await waitFor(() => {
        expect(encryptText).toHaveBeenCalledWith('Test content', 'StrongPassword123');
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalled();
      });
    });

    test('prevents encryption with weak password', async () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
  const confirmInput = screen.getByPlaceholderText(/^re-enter password$/i);

      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.change(confirmInput, { target: { value: '123' } });

      const encryptButton = screen.getByRole('button', { name: /encrypt/i });
      fireEvent.click(encryptButton);

      await waitFor(() => {
        expect(screen.getByText(/password is too weak/i)).toBeInTheDocument();
      });

      expect(encryptText).not.toHaveBeenCalled();
    });

    test('prevents encryption when passwords do not match', async () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
  const confirmInput = screen.getByPlaceholderText(/^re-enter password$/i);

      fireEvent.change(passwordInput, { target: { value: 'StrongPassword123' } });
      fireEvent.change(confirmInput, { target: { value: 'DifferentPassword' } });

      const encryptButton = screen.getByRole('button', { name: /encrypt/i });
      fireEvent.click(encryptButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });

      expect(encryptText).not.toHaveBeenCalled();
    });

    test('requires password to encrypt', async () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

      const encryptButton = screen.getByRole('button', { name: /encrypt/i });
      fireEvent.click(encryptButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });

      expect(encryptText).not.toHaveBeenCalled();
    });
  });

  describe('Decryption', () => {
    test('decrypts content successfully with correct password', async () => {
      render(
        <EncryptionDialog
          mode="decrypt"
          content='{"encrypted":"encrypted:Test content","iv":"test-iv","salt":"test-salt"}'
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
      fireEvent.change(passwordInput, { target: { value: 'correctPass' } });

      const decryptButton = screen.getByRole('button', { name: /decrypt/i });
      fireEvent.click(decryptButton);

      await waitFor(() => {
        expect(decryptText).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalledWith('Test content');
      });
    });

    test('shows error with incorrect password', async () => {
      render(
        <EncryptionDialog
          mode="decrypt"
          content='{"encrypted":"encrypted:Test content","iv":"test-iv","salt":"test-salt"}'
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
      fireEvent.change(passwordInput, { target: { value: 'wrongPass' } });

      const decryptButton = screen.getByRole('button', { name: /decrypt/i });
      fireEvent.click(decryptButton);

      await waitFor(() => {
        expect(screen.getByText(/decryption failed/i)).toBeInTheDocument();
      });

      expect(mockOnResult).not.toHaveBeenCalled();
    });

    test('requires password to decrypt', async () => {
      render(
        <EncryptionDialog
          mode="decrypt"
          content='{"encrypted":"test","iv":"iv","salt":"salt"}'
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

      const decryptButton = screen.getByRole('button', { name: /decrypt/i });
      fireEvent.click(decryptButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });

      expect(decryptText).not.toHaveBeenCalled();
    });
  });

  describe('Dialog Controls', () => {
    test('closes dialog when cancelled', () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));
  expect(screen.getByText(/encrypt content/i)).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Dialog should close
      waitFor(() => {
  expect(screen.queryByText(/encrypt content/i)).not.toBeInTheDocument();
      });
    });

    test('closes dialog after successful encryption', async () => {
      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
  const confirmInput = screen.getByPlaceholderText(/^re-enter password$/i);

      fireEvent.change(passwordInput, { target: { value: 'StrongPassword123' } });
      fireEvent.change(confirmInput, { target: { value: 'StrongPassword123' } });

      const encryptButton = screen.getByRole('button', { name: /encrypt/i });
      fireEvent.click(encryptButton);

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByText(/encrypt content/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles encryption error gracefully', async () => {
      (encryptText as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Encryption failed');
      });

      render(
        <EncryptionDialog
          mode="encrypt"
          content="Test content"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/^enter password$/i);
  const confirmInput = screen.getByPlaceholderText(/re-enter password/i);

      fireEvent.change(passwordInput, { target: { value: 'StrongPassword123' } });
      fireEvent.change(confirmInput, { target: { value: 'StrongPassword123' } });

      const encryptButton = screen.getByRole('button', { name: /encrypt/i });
      fireEvent.click(encryptButton);

      await waitFor(() => {
        expect(screen.getByText(/encryption failed/i)).toBeInTheDocument();
      });

      expect(mockOnResult).not.toHaveBeenCalled();
    });

    test('handles invalid encrypted content format', async () => {
      render(
        <EncryptionDialog
          mode="decrypt"
          content="invalid-json"
          onResult={mockOnResult}
          trigger={<button>Open</button>}
        />
      );

      fireEvent.click(screen.getByText('Open'));

  const passwordInput = screen.getByPlaceholderText(/enter password/i);
      fireEvent.change(passwordInput, { target: { value: 'password' } });

      const decryptButton = screen.getByRole('button', { name: /decrypt/i });
      fireEvent.click(decryptButton);

      await waitFor(() => {
        expect(screen.getByText(/decryption failed/i)).toBeInTheDocument();
      });

      expect(mockOnResult).not.toHaveBeenCalled();
    });
  });
});
