import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Radix Dialog uses portals; JSDOM supports it fine in tests.

describe('ui/Dialog', () => {
  it('opens and closes the dialog', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByText('Title')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open/i }));

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();

    // Close using the close button (sr-only label)
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('Title')).not.toBeInTheDocument();
  });
});
