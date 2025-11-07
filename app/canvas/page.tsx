import Link from 'next/link';
import CanvasEditor from '@/components/CanvasEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function CanvasPage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h1 className="text-lg font-semibold">Canvas</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3"
            aria-label="Back to Home"
          >
            Back to Home
          </Link>
        </div>
      </div>
      <div className="flex-1">
        <ErrorBoundary>
          <CanvasEditor />
        </ErrorBoundary>
      </div>
    </div>
  );
}
