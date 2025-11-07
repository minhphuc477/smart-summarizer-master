"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function KeyboardShortcutsDialog({ open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(open);

  const handleOpenChange = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange(v);
  };

  return (
    <Dialog open={internalOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Speed up navigating and managing your notes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span>Ctrl/⌘ + K</span><span>Command palette / Focus search</span></div>
          <div className="flex items-center justify-between"><span>J / K</span><span>Next / Previous note</span></div>
          <div className="flex items-center justify-between"><span>Enter</span><span>Open edit</span></div>
          <div className="flex items-center justify-between"><span>E</span><span>Edit note</span></div>
          <div className="flex items-center justify-between"><span>P</span><span>Pin / unpin note</span></div>
          <div className="flex items-center justify-between"><span>Delete / Backspace</span><span>Delete note</span></div>
          <div className="flex items-center justify-between pt-2"><span>Shift + ?</span><span>Show shortcuts</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
