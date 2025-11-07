import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingTour from '@/components/OnboardingTour';

jest.mock('@/lib/sampleNotes', () => ({
  getSampleGuestNotes: jest.fn(() => ([
    { original_notes: 'a', persona: null, summary: 's', takeaways: [], actions: [], tags: [], sentiment: 'neutral' },
    { original_notes: 'b', persona: 'x', summary: 's2', takeaways: ['t'], actions: [{ task: 'do', datetime: null }], tags: ['t'], sentiment: 'positive' },
  ])),
}));

const addGuestNote = jest.fn();
jest.mock('@/lib/guestMode', () => ({
  addGuestNote: (note: unknown) => addGuestNote(note),
}));

describe('OnboardingTour', () => {
  beforeEach(() => {
    addGuestNote.mockClear();
    window.localStorage.clear();
  });

  it('renders and navigates steps', () => {
    const onOpenChange = jest.fn();
    render(<OnboardingTour open={true} onOpenChange={onOpenChange} isGuestMode={true} />);

    expect(screen.getByText(/Welcome to Smart Summarizer/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText(/Summarize Anything/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByText(/Welcome to Smart Summarizer/i)).toBeInTheDocument();
  });

  it('adds sample notes in guest mode', () => {
    const onOpenChange = jest.fn();
    render(<OnboardingTour open={true} onOpenChange={onOpenChange} isGuestMode={true} />);
    fireEvent.click(screen.getByRole('button', { name: /Add Sample Notes/i }));
    expect(addGuestNote).toHaveBeenCalledTimes(2);
  });

  it('sets onboarding_done on finish', () => {
    const onOpenChange = jest.fn();
    render(<OnboardingTour open={true} onOpenChange={onOpenChange} isGuestMode={false} />);
    // Go to last step
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    }
    fireEvent.click(screen.getByRole('button', { name: /Finish/i }));
    expect(window.localStorage.getItem('onboarding_done')).toBe('true');
  });
});
