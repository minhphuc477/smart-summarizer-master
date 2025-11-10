"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Webhook,
  Plus,
  Trash2,
  Edit,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

// Safe JSON parser for fetch responses (handles empty body and invalid JSON gracefully)
type JsonLike = Record<string, unknown> | unknown[] | null;
async function safeJson<T extends JsonLike = JsonLike>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface WebhookData {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  created_at: string;
  last_triggered_at?: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status?: number;
  response_body?: string;
  error_message?: string;
  created_at: string;
  delivered_at?: string;
}

interface WebhooksManagerProps {
  session: Session;
}

const AVAILABLE_EVENTS = [
  'note.created',
  'note.updated',
  'note.deleted',
  'canvas.created',
  'canvas.updated',
  'comment.created',
];

  export default function WebhooksManager({ session: _session }: WebhooksManagerProps) {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null);

  // Form state
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch('/api/webhooks', {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to manage webhooks');
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch webhooks');
      }
      
      const parsed = await safeJson<{ webhooks?: WebhookData[] }>(response);
      setWebhooks(Array.isArray(parsed?.webhooks) ? parsed!.webhooks! : []);
    } catch (err: unknown) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        setError('Request timeout - please try again');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load webhooks');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const resetForm = () => {
    setUrl('');
    setSelectedEvents([]);
    setEnabled(true);
    setEditingWebhook(null);
    setError(null);
    setSuccess(null);
  };

  const handleCreate = async () => {
    if (!url || selectedEvents.length === 0) {
      setError('URL and at least one event are required');
      return;
    }

    try {
      const payload = {
        url,
        events: selectedEvents,
        enabled,
      };

      const endpoint = editingWebhook
        ? `/api/webhooks/${editingWebhook.id}`
        : '/api/webhooks';
      
      const method = editingWebhook ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const parsed = await safeJson<{ error?: string; webhook?: WebhookData }>(response);
      if (!response.ok) {
        throw new Error(parsed?.error || 'Operation failed');
      }

      setSuccess(editingWebhook ? 'Webhook updated!' : 'Webhook created!');
      setShowCreateDialog(false);
      resetForm();
      fetchWebhooks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEdit = (webhook: WebhookData) => {
    setEditingWebhook(webhook);
    setUrl(webhook.url);
    setSelectedEvents(webhook.events);
    setEnabled(webhook.enabled);
    setShowCreateDialog(true);
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setSuccess('Webhook deleted');
      fetchWebhooks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleTest = async (webhookId: string) => {
    setTesting(webhookId);
    setError(null);

    try {
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
      });

      const parsed = await safeJson<{ error?: string; success?: boolean; message?: string }>(response);
      if (!response.ok) {
        throw new Error(parsed?.error || 'Test failed');
      }

      setSuccess(parsed?.message || 'Test webhook fired! Check your endpoint.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(null);
    }
  };

  const fetchDeliveries = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/deliveries`);
      if (!response.ok) throw new Error('Failed to fetch deliveries');
      
      const parsed = await safeJson<{ deliveries?: WebhookDelivery[] }>(response);
      setDeliveries(prev => ({ ...prev, [webhookId]: Array.isArray(parsed?.deliveries) ? parsed!.deliveries! : [] }));
      setViewingDeliveries(webhookId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load deliveries');
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Webhook className="h-8 w-8" />
            Webhooks
          </h1>
          <p className="text-muted-foreground">
            Configure webhooks to receive real-time notifications about events
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Webhook
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first webhook to receive event notifications
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-2">
                      <Webhook className="h-5 w-5" />
                      {webhook.url}
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="secondary">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>
                        {webhook.enabled ? (
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Disabled
                          </Badge>
                        )}
                      </span>
                      {webhook.last_triggered_at && (
                        <span>
                          Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(webhook.id)}
                      disabled={testing === webhook.id}
                    >
                      {testing === webhook.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Test
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchDeliveries(webhook.id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Deliveries
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(webhook)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to receive event notifications
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Events to Subscribe</Label>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_EVENTS.map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={event}
                      checked={selectedEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <Label htmlFor={event} className="text-sm font-normal cursor-pointer">
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="enabled"
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(checked as boolean)}
              />
              <Label htmlFor="enabled" className="text-sm font-normal cursor-pointer">
                Enabled
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              {editingWebhook ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries Dialog */}
      <Dialog open={viewingDeliveries !== null} onOpenChange={(open) => {
        if (!open) setViewingDeliveries(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Deliveries</DialogTitle>
            <DialogDescription>
              Recent delivery attempts for this webhook
            </DialogDescription>
          </DialogHeader>
          
          {viewingDeliveries && deliveries[viewingDeliveries] ? (
            <div className="space-y-3">
              {deliveries[viewingDeliveries].length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No deliveries yet
                </p>
              ) : (
                deliveries[viewingDeliveries].map((delivery) => (
                  <Card key={delivery.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{delivery.event_type}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {new Date(delivery.created_at).toLocaleString()}
                          </p>
                        </div>
                        {delivery.response_status ? (
                          <Badge variant={delivery.response_status < 300 ? 'default' : 'destructive'}>
                            {delivery.response_status}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </div>
                    </CardHeader>
                    {delivery.error_message && (
                      <CardContent>
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{delivery.error_message}</AlertDescription>
                        </Alert>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
