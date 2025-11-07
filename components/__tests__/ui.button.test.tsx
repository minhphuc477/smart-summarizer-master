import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import React from 'react';

describe('ui/Button', () => {
  it('renders and handles clicks', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    const btn = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('applies variant and size classes', () => {
    render(<Button variant="outline" size="sm">A</Button>);
    const btn = screen.getByRole('button', { name: 'A' });
    expect(btn.className).toMatch(/border/);
    expect(btn.className).toMatch(/h-8/);
  });
});
