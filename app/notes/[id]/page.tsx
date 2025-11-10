"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Calendar,
  Hash,
  Target,
  Smile,
  Meh,
  Frown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

interface Note {
  id: number;
  user_id: string;
  workspace_id?: string;
  folder_id?: number;
  persona?: string;
  original_notes: string;
  summary: string;
  takeaways: string[];
  actions: Array<{ task: string; datetime?: string }>;
  sentiment: string;
  created_at: string;
  updated_at: string;
  pdf_document_id?: string;
}

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const noteId = params.id as string;

  useEffect(() => {
    // Get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (!noteId || !session) return;

    const fetchNote = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', parseInt(noteId))
          .eq('user_id', session.user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            setError('Note not found');
          } else {
            setError('Failed to load note');
          }
          return;
        }

        setNote(data);
      } catch (_err) {
        setError('Failed to load note');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [noteId, session]);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return <Smile className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <Frown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-muted-foreground">Loading note...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Note not found</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">Note #{note.id}</CardTitle>
                  {note.persona && (
                    <Badge variant="secondary">{note.persona}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(note.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed">{note.summary}</p>
            </CardContent>
          </Card>

          {/* Takeaways */}
          {note.takeaways && note.takeaways.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Key Takeaways
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {note.takeaways.map((takeaway, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {note.actions && note.actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Action Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {note.actions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <div>
                        <span>{action.task}</span>
                        {action.datetime && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Due: {new Date(action.datetime).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Original Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Original Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/50 p-4 rounded-lg">
                {note.original_notes}
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {getSentimentIcon(note.sentiment)}
                  <span className="text-sm">
                    Sentiment: <span className="capitalize">{note.sentiment || 'neutral'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">
                    Created: {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                {note.updated_at !== note.created_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      Updated: {new Date(note.updated_at).toLocaleString()}
                    </span>
                  </div>
                )}
                {note.pdf_document_id && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">From PDF document</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}