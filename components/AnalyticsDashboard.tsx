"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { TrendingUp, FileText, Clock, Activity, Smile, Hash, Calendar as CalendarIcon, BarChart as BarChartIcon } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';

type AnalyticsData = {
  analytics: Array<{
    date: string;
    notes_created: number;
    summaries_generated: number;
    canvases_created: number;
    templates_used: number;
    words_processed: number;
    active_minutes: number;
  }>;
  summary: {
    total_notes: number;
    total_summaries: number;
    total_canvases: number;
    total_templates_used: number;
    total_words: number;
    total_active_minutes: number;
    active_days: number;
    last_active_date: string;
  };
  topTags: Array<{
    name: string;
    count: number;
  }>;
  sentimentData?: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }>;
  sentimentDistribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
};

function AnalyticsDashboard({ userId: _userId }: { userId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30'); // days

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`/api/analytics?range=${range}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          toast.error('Failed to load analytics');
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [range]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <EmptyState
          icon={BarChartIcon}
          title="No analytics yet"
          description="Use the app to create notes and summaries. Your analytics will appear here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Analytics Dashboard</h2>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-background text-foreground"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary?.total_notes || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary?.active_days || 0} active days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Summaries</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary?.total_summaries || 0}</div>
            <p className="text-xs text-muted-foreground">
              AI-generated summaries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Words Processed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.summary?.total_words || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total words analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((data.summary?.total_active_minutes || 0) / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Time spent in app
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.analytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="notes_created" 
                stroke="#3b82f6" 
                name="Notes Created"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="summaries_generated" 
                stroke="#8b5cf6" 
                name="Summaries"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Notes', value: data.summary?.total_notes || 0 },
                { name: 'Canvases', value: data.summary?.total_canvases || 0 },
                { name: 'Templates', value: data.summary?.total_templates_used || 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sentiment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5" />
              Sentiment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Positive', value: data.sentimentDistribution?.positive || 0, color: '#10b981' },
                    { name: 'Neutral', value: data.sentimentDistribution?.neutral || 0, color: '#6b7280' },
                    { name: 'Negative', value: data.sentimentDistribution?.negative || 0, color: '#ef4444' },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#6b7280" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Over Time */}
      {data.sentimentData && data.sentimentData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Sentiment Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.sentimentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="positive" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="Positive"
                />
                <Area 
                  type="monotone" 
                  dataKey="neutral" 
                  stackId="1"
                  stroke="#6b7280" 
                  fill="#6b7280"
                  fillOpacity={0.6}
                  name="Neutral"
                />
                <Area 
                  type="monotone" 
                  dataKey="negative" 
                  stackId="1"
                  stroke="#ef4444" 
                  fill="#ef4444"
                  fillOpacity={0.6}
                  name="Negative"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tags and Productivity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Top Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topTags && data.topTags.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topTags.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No tags yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Productivity Heatmap - Words per day */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Words Processed Daily
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.analytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="words_processed" 
                  stroke="#f59e0b" 
                  fill="#f59e0b"
                  fillOpacity={0.6}
                  name="Words"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.analytics.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="notes_created" stackId="a" fill="#3b82f6" name="Notes" />
              <Bar dataKey="canvases_created" stackId="a" fill="#8b5cf6" name="Canvases" />
              <Bar dataKey="templates_used" stackId="a" fill="#ec4899" name="Templates" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

import { ErrorBoundary } from './ErrorBoundary';

export default function AnalyticsDashboardWithBoundary(props: { userId: string }) {
  return (
    <ErrorBoundary>
      <AnalyticsDashboard {...props} />
    </ErrorBoundary>
  );
}
