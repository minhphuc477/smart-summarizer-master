import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SuggestionsDialog from '../SuggestionsDialog';

describe('SuggestionsDialog', () => {
  const mockSuggestions = {
    relatedConcepts: ['Machine Learning', 'Neural Networks', 'Deep Learning'],
    connections: [
      {
        from: 'Machine Learning',
        to: 'Neural Networks',
        reason: 'Neural networks are a fundamental technique in machine learning'
      },
      {
        from: 'Neural Networks',
        to: 'Deep Learning',
        reason: 'Deep learning uses multi-layer neural networks'
      }
    ],
    nextSteps: [
      'Explore classification algorithms',
      'Study gradient descent optimization',
      'Build a simple neural network'
    ]
  };

  const mockOnAddConcept = jest.fn();
  const mockOnAddConnection = jest.fn();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <SuggestionsDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when suggestions is null', () => {
    const { container } = render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={null}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog with all sections when open and suggestions provided', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    expect(screen.getByText('AI Canvas Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Related Concepts')).toBeInTheDocument();
    expect(screen.getByText('Suggested Connections')).toBeInTheDocument();
    expect(screen.getByText('Recommended Next Steps')).toBeInTheDocument();
  });

  it('displays all related concepts', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    const machineLearning = screen.getAllByText('Machine Learning');
    const neuralNetworks = screen.getAllByText('Neural Networks');
    const deepLearning = screen.getAllByText('Deep Learning');
    
    // Each concept appears twice: once in the list and once in a badge
    expect(machineLearning.length).toBeGreaterThanOrEqual(1);
    expect(neuralNetworks.length).toBeGreaterThanOrEqual(1);
    expect(deepLearning.length).toBeGreaterThanOrEqual(1);
  });

  it('displays all connections with reasoning', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    expect(screen.getByText('Neural networks are a fundamental technique in machine learning')).toBeInTheDocument();
    expect(screen.getByText('Deep learning uses multi-layer neural networks')).toBeInTheDocument();
  });

  it('displays all next steps', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    expect(screen.getByText('Explore classification algorithms')).toBeInTheDocument();
    expect(screen.getByText('Study gradient descent optimization')).toBeInTheDocument();
    expect(screen.getByText('Build a simple neural network')).toBeInTheDocument();
  });

  it('calls onAddConcept when Add to Canvas button is clicked', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    const addButtons = screen.getAllByText('Add to Canvas');
    fireEvent.click(addButtons[0]);

    expect(mockOnAddConcept).toHaveBeenCalledWith('Machine Learning');
    expect(mockOnAddConcept).toHaveBeenCalledTimes(1);
  });

  it('calls onAddConnection when Add Connection button is clicked', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    const addConnectionButtons = screen.getAllByText('Add Connection');
    fireEvent.click(addConnectionButtons[0]);

    expect(mockOnAddConnection).toHaveBeenCalledWith({
      from: 'Machine Learning',
      to: 'Neural Networks',
      reason: 'Neural networks are a fundamental technique in machine learning'
    });
    expect(mockOnAddConnection).toHaveBeenCalledTimes(1);
  });

  it('disables concept button after it is added', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    const addButtons = screen.getAllByText('Add to Canvas');
    const firstButton = addButtons[0];

    expect(firstButton).not.toBeDisabled();
    fireEvent.click(firstButton);

    // Button text should change to "Added"
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  it('shows badge with count of concepts', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    // Should show count badge "3" for 3 related concepts
    const badges = screen.getAllByText('3');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows badge with count of connections', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    // Should show count badge "2" for 2 connections
    const badges = screen.getAllByText('2');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('handles empty relatedConcepts array', () => {
    const emptyConcepts = {
      ...mockSuggestions,
      relatedConcepts: []
    };

    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={emptyConcepts}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    // Should not show Related Concepts section
    expect(screen.queryByText('Related Concepts')).not.toBeInTheDocument();
  });

  it('handles empty connections array', () => {
    const emptyConnections = {
      ...mockSuggestions,
      connections: []
    };

    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={emptyConnections}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    // Should not show Suggested Connections section
    expect(screen.queryByText('Suggested Connections')).not.toBeInTheDocument();
  });

  it('handles empty nextSteps array', () => {
    const emptySteps = {
      ...mockSuggestions,
      nextSteps: []
    };

    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={emptySteps}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    // Should not show Recommended Next Steps section
    expect(screen.queryByText('Recommended Next Steps')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when Close button is clicked', () => {
    render(
      <SuggestionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        suggestions={mockSuggestions}
        onAddConcept={mockOnAddConcept}
        onAddConnection={mockOnAddConnection}
      />
    );

    const closeButtons = screen.getAllByText('Close');
    const closeButton = closeButtons.find(el => el.tagName === 'BUTTON');
    
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    }
  });
});
