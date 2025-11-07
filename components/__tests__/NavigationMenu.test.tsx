import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavigationMenu from '../NavigationMenu';

// Mock next/navigation
const mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => mockPathname),
}));

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
  // Satisfy react/display-name lint rule
  (MockLink as React.FC & { displayName?: string }).displayName = 'MockNextLink';
  return MockLink;
});

describe('NavigationMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all navigation links', () => {
    render(<NavigationMenu />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  test('renders correct href attributes', () => {
    render(<NavigationMenu />);

    const homeLink = screen.getByText('Home').closest('a');
    const canvasLink = screen.getByText('Canvas').closest('a');
    const analyticsLink = screen.getByText('Analytics').closest('a');

    expect(homeLink).toHaveAttribute('href', '/');
    expect(canvasLink).toHaveAttribute('href', '/canvas');
    expect(analyticsLink).toHaveAttribute('href', '/analytics');
  });

  test('applies active variant to current route', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/');

    render(<NavigationMenu />);

    const homeButton = screen.getByText('Home').closest('button');
    expect(homeButton).toHaveClass('bg-primary'); // default variant has bg-primary
  });

  test('applies ghost variant to inactive routes', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/');

    render(<NavigationMenu />);

    const canvasButton = screen.getByText('Canvas').closest('button');
    const analyticsButton = screen.getByText('Analytics').closest('button');

    // Ghost buttons should not have bg-primary
    expect(canvasButton).not.toHaveClass('bg-primary');
    expect(analyticsButton).not.toHaveClass('bg-primary');
  });

  test('highlights Analytics page when on /analytics', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/analytics');

    render(<NavigationMenu />);

    const analyticsButton = screen.getByText('Analytics').closest('button');
    expect(analyticsButton).toHaveClass('bg-primary');
  });

  test('highlights Canvas page when on /canvas', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/canvas');

    render(<NavigationMenu />);

    const canvasButton = screen.getByText('Canvas').closest('button');
    expect(canvasButton).toHaveClass('bg-primary');
  });

  test('renders icons for each navigation item', () => {
    render(<NavigationMenu />);

    // Check that SVG icons are rendered (lucide icons render as SVGs)
    const nav = screen.getByRole('navigation');
    const svgs = nav.querySelectorAll('svg');
    
    expect(svgs.length).toBeGreaterThanOrEqual(3); // At least one icon per link
  });

  test('renders within a nav element', () => {
    render(<NavigationMenu />);

    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('flex', 'gap-2');
  });

  test('buttons have correct size class', () => {
    render(<NavigationMenu />);

    const buttons = screen.getAllByRole('button');
    
    buttons.forEach(button => {
      expect(button).toHaveClass('h-8'); // size="sm" includes h-8
    });
  });

  test('labels are hidden on small screens', () => {
    render(<NavigationMenu />);

    const homeLabel = screen.getByText('Home');
    const canvasLabel = screen.getByText('Canvas');
    const analyticsLabel = screen.getByText('Analytics');

    // The spans should have 'hidden sm:inline' classes
    expect(homeLabel).toHaveClass('hidden', 'sm:inline');
    expect(canvasLabel).toHaveClass('hidden', 'sm:inline');
    expect(analyticsLabel).toHaveClass('hidden', 'sm:inline');
  });
});
