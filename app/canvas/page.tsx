"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, Loader2, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Prevent static generation for this dynamic page
export const dynamic = 'force-dynamic';

type Canvas = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export default function CanvasListPage() {
  const router = useRouter();
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchCanvases = async () => {
    try {
      const response = await fetch('/api/canvases');
      if (!response.ok) {
        // Handle 401 gracefully - user might not be authenticated yet
        if (response.status === 401) {
          console.warn('User not authenticated for canvases');
          setCanvases([]);
          return;
        }
        throw new Error('Failed to fetch canvases');
      }
      const data = await response.json();
      setCanvases(data.canvases || []);
    } catch (error) {
      console.error('Error fetching canvases:', error);
      // Show user-friendly error message
      const errorMessage = error instanceof Error && error.message.includes('fetch failed')
        ? 'Network connection error. Please check your internet connection.'
        : 'Failed to load canvases';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCanvases();
  }, []);

  const handleCreateNew = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Canvas' }),
      });
      
      if (!response.ok) throw new Error('Failed to create canvas');
      const data = await response.json();
      router.push(`/canvas/${data.canvas.id}`);
    } catch (error) {
      console.error('Error creating canvas:', error);
      toast.error('Failed to create canvas');
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    
    try {
      const response = await fetch(`/api/canvases/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete canvas');
      setCanvases(canvases.filter(c => c.id !== id));
      toast.success('Canvas deleted');
    } catch (error) {
      console.error('Error deleting canvas:', error);
      toast.error('Failed to delete canvas');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Canvases</h1>
            <p className="text-sm text-muted-foreground">Visual brainstorming and note organization</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateNew} disabled={creating}>
              {creating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                <><Plus className="mr-2 h-4 w-4" /> New Canvas</>
              )}
            </Button>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>

      <ErrorBoundary>
        <div className="container mx-auto px-6 py-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : canvases.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No canvases yet</h2>
              <p className="text-muted-foreground mb-6">
                Create your first canvas to start visualizing your ideas
              </p>
              <Button onClick={handleCreateNew} size="lg" disabled={creating}>
                {creating ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="mr-2 h-5 w-5" /> Create Your First Canvas</>
                )}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {canvases.map((canvas) => (
                <Card key={canvas.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="truncate">{canvas.title || 'Untitled Canvas'}</CardTitle>
                    {canvas.description && (
                      <CardDescription className="line-clamp-2">
                        {canvas.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground mb-4">
                      <Calendar className="h-3 w-3 mr-1" />
                      Updated {new Date(canvas.updated_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/canvas/${canvas.id}`} className="flex-1">
                        <Button className="w-full" size="sm">
                          Open
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(canvas.id, canvas.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
