/**
 * Usage tracking utility - tracks user activity for analytics
 */

let lastEventTime = Date.now();
let sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export type UsageEventType = 
  | 'note_created'
  | 'note_viewed'
  | 'search_performed'
  | 'pdf_uploaded'
  | 'canvas_opened'
  | 'app_opened'
  | 'workspace_changed'
  | 'folder_changed';

/**
 * Track a usage event
 */
export async function trackUsageEvent(
  userId: string | null,
  eventType: UsageEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (!userId) return; // Don't track guest users

  const now = Date.now();
  const timeSinceLastEvent = now - lastEventTime;
  
  // If more than 30 minutes since last event, start new session
  if (timeSinceLastEvent > 30 * 60 * 1000) {
    sessionId = `session_${now}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  lastEventTime = now;

  try {
    // Fire and forget - don't block UI
    fetch('/api/usage-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        eventType,
        metadata: {
          ...metadata,
          sessionId,
          timestamp: new Date().toISOString(),
        },
      }),
    }).catch(err => {
      console.warn('Failed to track usage event:', err);
    });
  } catch (error) {
    console.warn('Failed to track usage event:', error);
  }
}

/**
 * Initialize usage tracking for the session
 */
export function initializeUsageTracking(userId: string | null): void {
  if (!userId) return;
  
  trackUsageEvent(userId, 'app_opened');
  
  // Track page visibility changes
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        trackUsageEvent(userId, 'app_opened');
      }
    });
  }
}
