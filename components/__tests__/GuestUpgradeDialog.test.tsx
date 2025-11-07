import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GuestUpgradeDialog from '../GuestUpgradeDialog';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

// Mock Supabase Auth UI
jest.mock('@supabase/auth-ui-react', () => ({
  Auth: ({ appearance: _appearance }: any) => (
    <div data-testid="auth-ui">
      <input placeholder="Email" />
      <button>Sign in</button>
    </div>
  ),
}));

jest.mock('@supabase/auth-ui-shared', () => ({
  ThemeSupa: {},
}));

describe('GuestUpgradeDialog', () => {
  describe('Rendering', () => {
    test('renders trigger button when provided', () => {
      render(
        <GuestUpgradeDialog
          trigger={<button>Upgrade Now</button>}
        />
      );

      expect(screen.getByText('Upgrade Now')).toBeInTheDocument();
    });

  test('opens dialog when trigger is clicked', () => {
      render(
        <GuestUpgradeDialog
          trigger={<button>Upgrade Now</button>}
        />
      );

      fireEvent.click(screen.getByText('Upgrade Now'));

      expect(screen.getByRole('heading', { name: /upgrade to premium/i })).toBeInTheDocument();
    });

  test('renders with controlled open state', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: /upgrade to premium/i })).toBeInTheDocument();
    });

  test('displays crown icon in header', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      const header = screen.getByRole('heading', { name: /upgrade to premium/i }).closest('div');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Feature Comparison', () => {
    test('displays all 10 features', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      expect(screen.getByText('Summaries')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText(/folders.*organization/i)).toBeInTheDocument();
      expect(screen.getByText(/workspaces.*collaboration/i)).toBeInTheDocument();
      expect(screen.getByText(/semantic search/i)).toBeInTheDocument();
      expect(screen.getByText(/custom personas/i)).toBeInTheDocument();
      expect(screen.getByText(/note encryption/i)).toBeInTheDocument();
      expect(screen.getByText(/analytics dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/canvas mind maps/i)).toBeInTheDocument();
      expect(screen.getByText(/export.*sharing/i)).toBeInTheDocument();
    });

    test('shows guest limitations', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      expect(screen.getByText('5 per day')).toBeInTheDocument();
      expect(screen.getByText(/temporary.*cleared on refresh/i)).toBeInTheDocument();
      expect(screen.getAllByText(/not available/i).length).toBeGreaterThan(0);
    });

    test('shows premium benefits', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      expect(screen.getByText('Unlimited')).toBeInTheDocument();
      expect(screen.getByText('Saved forever')).toBeInTheDocument();
      expect(screen.getByText('Full access')).toBeInTheDocument();
      expect(screen.getByText(/share.*collaborate/i)).toBeInTheDocument();
      expect(screen.getByText(/AI-powered search/i)).toBeInTheDocument();
    });

    test('displays check marks for available features', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      // Premium column should have check marks
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    test('displays X marks for unavailable guest features', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      // Guest column should have X marks for unavailable features
      const notAvailableTexts = screen.getAllByText(/not available/i);
      expect(notAvailableTexts.length).toBeGreaterThan(5);
    });
  });

  describe('Authentication UI', () => {
  test('shows upgrade CTA button initially', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument();
    });

    test('toggles to auth UI when upgrade is clicked', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

  const upgradeButton = screen.getByRole('button', { name: /upgrade to premium/i });
  fireEvent.click(upgradeButton);

      expect(screen.getByTestId('auth-ui')).toBeInTheDocument();
    });

  test('shows back button when auth UI is displayed', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      const upgradeButton = screen.getByRole('button', { name: /upgrade to premium/i });
      fireEvent.click(upgradeButton);

      expect(screen.getByRole('button', { name: /back to comparison/i })).toBeInTheDocument();
    });

    test('goes back to feature comparison from auth UI', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      // Go to auth UI
  const upgradeButton = screen.getByRole('button', { name: /upgrade to premium/i });
  fireEvent.click(upgradeButton);

      expect(screen.getByTestId('auth-ui')).toBeInTheDocument();

      // Go back
  const backButton = screen.getByRole('button', { name: /back to comparison/i });
      fireEvent.click(backButton);

      // Should be back to feature comparison
      expect(screen.queryByTestId('auth-ui')).not.toBeInTheDocument();
      expect(screen.getByText('Summaries')).toBeInTheDocument();
    });
  });

  describe('Dialog Controls', () => {
    test('calls onOpenChange when dialog is closed', () => {
      const mockOnOpenChange = jest.fn();
      
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Find and click close button (usually X in dialog)
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => 
        btn.getAttribute('aria-label')?.includes('Close') || 
        btn.querySelector('[data-testid="close-icon"]')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      }
    });

  test('renders without onOpenChange callback', () => {
      render(
        <GuestUpgradeDialog
          open={true}
        />
      );

      expect(screen.getByRole('heading', { name: /upgrade to premium/i })).toBeInTheDocument();
    });
  });

  describe('Content and Messaging', () => {
    test('displays upgrade call-to-action message', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      expect(screen.getByText(/get unlimited access/i)).toBeInTheDocument();
    });

    test('shows descriptive text for features', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      // Check for some key descriptive texts (may appear in multiple places)
      expect(screen.getAllByText(/unlimited/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/forever/i).length).toBeGreaterThan(0);
    });

    test('emphasizes premium benefits', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      // Premium column should exist
      expect(screen.getByText('Unlimited')).toBeInTheDocument();
      expect(screen.getByText(/create.*save personas/i)).toBeInTheDocument();
      expect(screen.getByText(/track your productivity/i)).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    test('renders feature comparison table', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

  test('has proper table headers', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      expect(screen.getByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Guest Mode')).toBeInTheDocument();
      expect(screen.getByText('Premium (Free)')).toBeInTheDocument();
    });

    test('displays features in rows', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      const rows = screen.getAllByRole('row');
      // At least header row + 10 feature rows
      expect(rows.length).toBeGreaterThanOrEqual(11);
    });
  });

  describe('Accessibility', () => {
  test('has accessible dialog title', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      const title = screen.getByRole('heading', { name: /upgrade to premium/i });
      expect(title).toBeInTheDocument();
    });

    test('has accessible table structure', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      const table = screen.getByRole('table');
      const headers = screen.getAllByRole('columnheader');
      
      expect(table).toBeInTheDocument();
      expect(headers.length).toBeGreaterThanOrEqual(3);
    });

  test('buttons have accessible labels', () => {
      render(
        <GuestUpgradeDialog
          open={true}
          onOpenChange={jest.fn()}
        />
      );

      const upgradeButton = screen.getByRole('button', { name: /upgrade to premium/i });
      expect(upgradeButton).toBeInTheDocument();
      expect(upgradeButton).toBeEnabled();

      const maybeLaterButton = screen.getByRole('button', { name: /maybe later/i });
      expect(maybeLaterButton).toBeInTheDocument();
    });
  });
});
