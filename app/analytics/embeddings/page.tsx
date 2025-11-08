'use client';

import { useRouter } from 'next/navigation';
import EmbeddingMetricsDashboard from '@/components/EmbeddingMetricsDashboard';

export default function EmbeddingMetricsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Embedding Metrics</h1>
          <p className="text-muted-foreground mt-2">
            Monitor embedding generation performance and statistics
          </p>
        </div>
        <button
          onClick={() => router.push('/analytics')}
          className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3"
          aria-label="Back to Analytics"
        >
          Back to Analytics
        </button>
      </div>
      <EmbeddingMetricsDashboard />
    </div>
  );
}
