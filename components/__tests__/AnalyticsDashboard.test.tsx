import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import React from 'react';

// Mock recharts primitives to avoid DOM/ResizeObserver complexities
jest.mock('recharts', () => {
  const React = require('react');
  const Pass = ({ children, ...props }: any) => <div data-testid="recharts" {...props}>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    LineChart: Pass,
    BarChart: Pass,
    PieChart: Pass,
    AreaChart: Pass,
    CartesianGrid: Pass,
    XAxis: Pass,
    YAxis: Pass,
    Tooltip: Pass,
    Legend: Pass,
    Line: Pass,
    Bar: Pass,
    Pie: Pass,
    Cell: Pass,
    Area: Pass,
  };
});

describe('AnalyticsDashboard', () => {
  const samplePayload = {
    analytics: [
      { date: new Date().toISOString(), notes_created: 2, summaries_generated: 1, canvases_created: 1, templates_used: 0, words_processed: 500, active_minutes: 10 },
    ],
    summary: {
      total_notes: 10,
      total_summaries: 5,
      total_canvases: 3,
      total_templates_used: 7,
      total_words: 12345,
      total_active_minutes: 180,
      active_days: 6,
      last_active_date: new Date().toISOString(),
    },
    topTags: [
      { name: 'work', count: 3 },
      { name: 'ideas', count: 2 },
    ],
    sentimentData: [
      { date: new Date().toISOString().split('T')[0], positive: 5, neutral: 3, negative: 2 },
    ],
    sentimentDistribution: {
      positive: 5,
      neutral: 3,
      negative: 2,
    },
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => samplePayload });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders loading skeleton then dashboard with summary stats', async () => {
    render(<AnalyticsDashboard userId="user-1" />);
    // Loading state - skeleton doesn't have role="status" by default; just verify text not present yet
    expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();

    // Dashboard content after fetch
    await screen.findByText('Analytics Dashboard');
    expect(screen.getByText('Total Notes')).toBeInTheDocument();
    expect(screen.getByText('Summaries')).toBeInTheDocument();
    // Summary numbers display
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('changes range and refetches analytics', async () => {
    render(<AnalyticsDashboard userId="user-1" />);
    await screen.findByText('Analytics Dashboard');

    const select = screen.getByDisplayValue('Last 30 days');
    (global.fetch as jest.Mock).mockClear();

    fireEvent.change(select, { target: { value: '7' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/api/analytics?range=7');
    });
  });
});
