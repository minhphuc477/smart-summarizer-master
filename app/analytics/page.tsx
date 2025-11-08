"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/lib/supabase';

export default function AnalyticsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  if (!userId) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track your usage and productivity insights
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/analytics/embeddings')}
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3"
            aria-label="Embedding Metrics"
          >
            Embedding Metrics
          </button>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3"
            aria-label="Back to Home"
          >
            Back to Home
          </button>
        </div>
      </div>
      <ErrorBoundary>
        <AnalyticsDashboard userId={userId} />
      </ErrorBoundary>
    </div>
  );
}
