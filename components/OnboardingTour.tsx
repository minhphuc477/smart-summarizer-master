"use client";

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import * as guest from '@/lib/guestMode';
import { getSampleGuestNotes } from '@/lib/sampleNotes';

type OnboardingTourProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGuestMode: boolean;
};

export default function OnboardingTour({ open, onOpenChange, isGuestMode }: OnboardingTourProps) {
  const steps = useMemo(() => ([
    {
      title: 'Welcome to Smart Summarizer',
      description: 'Turn messy notes into clear summaries. We\'ll show you the essentials in a minute.'
    },
    {
      title: 'Summarize Anything',
      description: 'Paste text or a URL to get a concise summary, key takeaways, action items, tags, and sentiment.'
    },
    {
      title: 'Organize & Search',
      description: 'Use folders, tags, and semantic search to find what matters by meaning, not just keywords.'
    },
    {
      title: 'Connect Notes',
      description: 'Discover related notes and suggested tags powered by local embeddings — privacy-first.'
    },
    {
      title: 'Try a Canvas',
      description: 'Visualize ideas on a canvas. Use the command palette (Ctrl/⌘+K) for layouts, export, and more.'
    },
  ]), []);

  const [index, setIndex] = useState(0);
  const last = index === steps.length - 1;

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  const addSamples = () => {
    if (!isGuestMode) return;
    const samples = getSampleGuestNotes();
    samples.forEach(s => guest.addGuestNote(s));
  };

  const finish = () => {
    try { localStorage.setItem('onboarding_done', 'true'); } catch {}
    onOpenChange(false);
  };

  const current = steps[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.description}</DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          Step {index + 1} of {steps.length}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => (index > 0 ? setIndex(index - 1) : onOpenChange(false))}>
            {index > 0 ? 'Back' : 'Close'}
          </Button>
          {isGuestMode && (
            <Button variant="secondary" onClick={addSamples}>
              Add Sample Notes
            </Button>
          )}
          {!last ? (
            <Button onClick={() => setIndex(index + 1)}>Next</Button>
          ) : (
            <Button onClick={finish}>Finish</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
