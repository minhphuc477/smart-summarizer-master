"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateCalendarLinks, downloadICS } from '@/lib/calendarLinks';
import { ActionItem } from '@/lib/guestMode';

type SharedNote = {
  id: string;
  summary: string;
  takeaways: string[];
  actions: ActionItem[];
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  created_at: string;
};

export default function SharePage() {
  const params = useParams();
  const shareId = params.shareId as string;
  
  const [note, setNote] = useState<SharedNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNote() {
      try {
        const response = await fetch(`/api/share/${shareId}`);
        
        if (!response.ok) {
          throw new Error('Note not found or not public');
        }

        const data = await response.json();
        setNote(data.note);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load note');
      } finally {
        setLoading(false);
      }
    }

    fetchNote();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Note not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Get sentiment color
  const sentimentColors = {
    positive: 'text-green-600 dark:text-green-400',
    neutral: 'text-gray-600 dark:text-gray-400',
    negative: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">
            Shared Summary
          </h1>
          <p className="text-muted-foreground">
            Created on {new Date(note.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📝 Summary
              {note.sentiment && (
                <span className={`text-sm font-normal ${sentimentColors[note.sentiment]}`}>
                  • {note.sentiment}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{note.summary}</p>
          </CardContent>
        </Card>

        {/* Takeaways */}
        <Card>
          <CardHeader>
            <CardTitle>💡 Key Takeaways</CardTitle>
          </CardHeader>
          <CardContent>
            {note.takeaways.length > 0 ? (
              <ul className="list-disc list-inside space-y-2 text-foreground">
                {note.takeaways.map((item, index) => (
                  <li key={`takeaway-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground italic">No takeaways found.</p>
            )}
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card>
          <CardHeader>
            <CardTitle>✅ Action Items</CardTitle>
          </CardHeader>
          <CardContent>
            {note.actions.length > 0 ? (
              <ul className="list-disc list-inside space-y-2 text-foreground">
                {note.actions.map((item, index) => (
                  <li key={`action-${index}`} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span>{item.task}</span>
                      {item.datetime && (
                        <span className="text-xs text-muted-foreground">
                          ({new Date(item.datetime).toLocaleString()})
                        </span>
                      )}
                    </div>
                    {item.datetime && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(() => {
                            const links = generateCalendarLinks({
                              task: item.task,
                              datetime: item.datetime,
                              description: note.summary.slice(0, 100)
                            });
                            return (
                              <>
                                <DropdownMenuItem asChild>
                                  <a href={links.google} target="_blank" rel="noopener noreferrer">
                                    Google Calendar
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={links.outlook} target="_blank" rel="noopener noreferrer">
                                    Outlook.com
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={links.office365} target="_blank" rel="noopener noreferrer">
                                    Office 365
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={links.yahoo} target="_blank" rel="noopener noreferrer">
                                    Yahoo Calendar
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => downloadICS(
                                    item.task,
                                    item.datetime!,
                                    60,
                                    note.summary.slice(0, 100)
                                  )}
                                >
                                  Download ICS
                                </DropdownMenuItem>
                              </>
                            );
                          })()}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground italic">No action items found.</p>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>🏷️ Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, index) => (
                  <span
                    key={`tag-${index}`}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm pt-8">
          <p>Powered by Smart Summarizer</p>
        </div>
      </div>
    </div>
  );
}
