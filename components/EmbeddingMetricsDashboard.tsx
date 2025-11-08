"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ModelStats {
  model: string;
  count: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
}

interface MetricsData {
  total_embeddings: number;
  by_model: ModelStats[];
  overall: {
    count: number;
    avg_duration_ms: number;
    min_duration_ms: number;
    max_duration_ms: number;
    p50_duration_ms: number;
    p95_duration_ms: number;
    p99_duration_ms: number;
  };
  job_status: Record<string, number>;
  generated_at: string;
}

export default function EmbeddingMetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [runningBackfill, setRunningBackfill] = useState(false);
  const [bfUserId, setBfUserId] = useState('');
  const [bfLimit, setBfLimit] = useState(50);
  const [bfDryRun, setBfDryRun] = useState(true);

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      setError(null);
      setRefreshing(true);
      const response = await fetch('/api/embedding/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runBackfill = async () => {
    try {
      setRunningBackfill(true);
      const response = await fetch('/api/admin/backfill-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: bfUserId || undefined, limit: bfLimit, dryRun: bfDryRun })
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Backfill failed');
        return;
      }
      toast.success(bfDryRun ? `Dry run: ${data.count ?? data.processed} notes need embeddings` : `Backfill finished: ${data.succeeded} succeeded, ${data.failed} failed`);
      fetchMetrics();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backfill error');
    } finally {
      setRunningBackfill(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.total_embeddings === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Embedding Metrics</CardTitle>
          <CardDescription>No embedding metrics available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Embedding Metrics</h2>
          <p className="text-muted-foreground text-sm">
            Last updated: {new Date(metrics.generated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchMetrics} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Embeddings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total_embeddings.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.overall.avg_duration_ms)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              P95 Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.overall.p95_duration_ms)}</div>
            <p className="text-xs text-muted-foreground mt-1">95th percentile</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              P99 Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.overall.p99_duration_ms)}</div>
            <p className="text-xs text-muted-foreground mt-1">99th percentile</p>
          </CardContent>
        </Card>
      </div>

      {/* Job Status */}
      {metrics.job_status && Object.keys(metrics.job_status).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Job Status</CardTitle>
            <CardDescription>Current embedding job queue status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metrics.job_status).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <div>
                    <p className="text-sm font-medium capitalize">{status}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backfill Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Backfill Embeddings</CardTitle>
          <CardDescription>Generate embeddings for notes missing vectors. Leave User ID empty to use your own account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="bf-user">User ID</Label>
              <Input id="bf-user" placeholder="optional" value={bfUserId} onChange={(e) => setBfUserId(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bf-limit">Limit</Label>
              <Input id="bf-limit" type="number" min={1} max={500} value={bfLimit} onChange={(e) => setBfLimit(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="bf-dry" checked={bfDryRun} onCheckedChange={setBfDryRun} />
              <Label htmlFor="bf-dry">Dry run</Label>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={runBackfill} disabled={runningBackfill}>
              {runningBackfill ? 'Running…' : bfDryRun ? 'Preview Backfill' : 'Run Backfill'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* By Model Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Model</CardTitle>
          <CardDescription>Detailed metrics for each embedding model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {metrics.by_model.map((model) => (
              <div key={model.model} className="border-b pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{model.model}</h3>
                  <Badge variant="secondary">{model.count} embeddings</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Average</p>
                    <p className="font-semibold">{formatDuration(model.avg_duration_ms)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Median (P50)</p>
                    <p className="font-semibold">{formatDuration(model.p50_duration_ms)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">P95</p>
                    <p className="font-semibold">{formatDuration(model.p95_duration_ms)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">P99</p>
                    <p className="font-semibold">{formatDuration(model.p99_duration_ms)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Min</p>
                    <p className="font-semibold">{formatDuration(model.min_duration_ms)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Max</p>
                    <p className="font-semibold">{formatDuration(model.max_duration_ms)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
