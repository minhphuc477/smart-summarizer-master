# Webhooks Implementation Guide

## Overview

The Smart Summarizer webhooks system allows you to receive real-time HTTP notifications when events occur in your account. This is useful for:

- **Integrations**: Connect Smart Summarizer to other tools (Slack, Discord, Zapier, etc.)
- **Real-time updates**: Get notified immediately when notes are created/updated/deleted
- **Automation**: Trigger workflows based on Smart Summarizer events
- **Monitoring**: Track activity in your account

## Architecture

### Components

1. **Database Tables**
   - `webhooks`: Stores webhook endpoint configurations
   - `webhook_deliveries`: Tracks delivery attempts and results

2. **API Endpoints**
   - `GET/POST /api/v1/webhooks`: List and create webhooks
   - `GET/PUT/DELETE /api/v1/webhooks/[id]`: Manage individual webhooks
   - `POST /api/v1/webhooks/[id]/test`: Test webhook configuration
   - `GET /api/v1/webhooks/[id]/deliveries`: View delivery history

3. **Background Processor**
   - `/api/cron/process-webhooks`: Cron job that delivers pending webhooks
   - Runs every minute via Vercel Cron
   - Handles retries with exponential backoff

4. **Triggers**
   - Automatic database triggers fire webhooks on note events
   - Queues deliveries for background processing

### Event Flow

```
Note Created → Database Trigger → Create Delivery Record → Background Processor → HTTP POST to Your Endpoint
```

## Supported Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `note.created` | New note created | After INSERT on notes |
| `note.updated` | Note modified | After UPDATE on notes |
| `note.deleted` | Note removed | After DELETE on notes |
| `folder.created` | New folder created | After INSERT on folders |
| `folder.updated` | Folder modified | After UPDATE on folders |
| `folder.deleted` | Folder removed | After DELETE on folders |
| `comment.created` | Comment added | After INSERT on comments |
| `comment.updated` | Comment modified | After UPDATE on comments |
| `comment.deleted` | Comment removed | After DELETE on comments |

## Webhook Payload Format

Every webhook delivery sends a POST request with JSON body:

```json
{
  "event": "note.created",
  "timestamp": "2025-11-01T10:00:00Z",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "user_123",
    "original_notes": "Meeting notes...",
    "summary": "Key points discussed...",
    "tags": [
      { "id": "tag_1", "name": "meeting" }
    ],
    "created_at": "2025-11-01T10:00:00Z"
  },
  "user_id": "user_123"
}
```

### Event-Specific Data

#### note.created
```json
{
  "event": "note.created",
  "data": { /* complete note object */ }
}
```

#### note.updated
```json
{
  "event": "note.updated",
  "data": {
    "id": "note_id",
    "old": { /* previous values */ },
    "new": { /* updated values */ }
  }
}
```

#### note.deleted
```json
{
  "event": "note.deleted",
  "data": { /* deleted note object */ }
}
```

## Security: Signature Verification

Every webhook includes an `X-Webhook-Signature` header with HMAC-SHA256 signature:

```
X-Webhook-Signature: sha256=a1b2c3d4e5f6...
```

### Verifying Signatures

#### Node.js
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = 'sha256=' + hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  const secret = 'your_webhook_secret';

  if (!verifyWebhookSignature(payload, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook...
  console.log('Event:', req.body.event);
  
  res.status(200).send('OK');
});
```

#### Python
```python
import hmac
import hashlib

def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected)

# Flask example
from flask import Flask, request, Response

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_data(as_text=True)
    secret = 'your_webhook_secret'
    
    if not verify_webhook_signature(payload, signature, secret):
        return Response('Invalid signature', status=401)
    
    data = request.json
    print(f"Event: {data['event']}")
    
    return Response('OK', status=200)
```

#### Go
```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "net/http"
)

func verifyWebhookSignature(payload, signature, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(payload))
    expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expected))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    signature := r.Header.Get("X-Webhook-Signature")
    secret := "your_webhook_secret"
    
    if !verifyWebhookSignature(string(body), signature, secret) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }
    
    // Process webhook...
    w.WriteHeader(http.StatusOK)
}
```

## API Usage

### Create Webhook

```bash
curl -X POST 'https://smart-summarizer.app/api/v1/webhooks' \
  -H 'Authorization: Bearer sk_live_your_api_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://your-domain.com/webhook",
    "events": ["note.created", "note.updated"],
    "description": "Production webhook for note events",
    "filters": {
      "folder_id": "123e4567-e89b-12d3-a456-426614174000"
    },
    "retry_attempts": 3,
    "timeout_seconds": 10
  }'
```

**Response:**
```json
{
  "id": "webhook_123",
  "user_id": "user_123",
  "url": "https://your-domain.com/webhook",
  "secret": "a1b2c3d4e5f6g7h8i9j0...",
  "events": ["note.created", "note.updated"],
  "filters": {
    "folder_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "is_active": true,
  "created_at": "2025-11-01T10:00:00Z"
}
```

**IMPORTANT**: Save the `secret` value - it won't be shown again!

### List Webhooks

```bash
curl -X GET 'https://smart-summarizer.app/api/v1/webhooks' \
  -H 'Authorization: Bearer sk_live_your_api_key'
```

### Update Webhook

```bash
curl -X PUT 'https://smart-summarizer.app/api/v1/webhooks/webhook_123' \
  -H 'Authorization: Bearer sk_live_your_api_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "is_active": false,
    "events": ["note.created"]
  }'
```

### Test Webhook

```bash
curl -X POST 'https://smart-summarizer.app/api/v1/webhooks/webhook_123/test' \
  -H 'Authorization: Bearer sk_live_your_api_key'
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook test successful",
  "statusCode": 200,
  "responseTime": 145
}
```

### View Delivery History

```bash
curl -X GET 'https://smart-summarizer.app/api/v1/webhooks/webhook_123/deliveries?status=failed' \
  -H 'Authorization: Bearer sk_live_your_api_key'
```

### Delete Webhook

```bash
curl -X DELETE 'https://smart-summarizer.app/api/v1/webhooks/webhook_123' \
  -H 'Authorization: Bearer sk_live_your_api_key'
```

## Retry Logic

Failed webhook deliveries are automatically retried with exponential backoff:

- **Attempt 1**: Immediate
- **Attempt 2**: After 1 minute
- **Attempt 3**: After 5 minutes
- **Attempt 4**: After 30 minutes (if max_attempts > 3)

### Success Criteria

A delivery is considered successful if:
- HTTP status code is 2xx (200-299)
- Response received within timeout period (default: 10 seconds)

### Failure Scenarios

Deliveries fail if:
- HTTP status code is not 2xx
- Request times out
- Network error occurs
- SSL certificate validation fails

## Filtering Events

You can filter which events trigger webhooks using the `filters` field:

```json
{
  "filters": {
    "folder_id": "folder_uuid",
    "tags": ["meeting", "important"]
  }
}
```

Currently supported filters:
- `folder_id`: Only trigger for notes in specific folder
- More filters coming soon (tags, sentiment, etc.)

## Best Practices

### 1. Endpoint Requirements

Your webhook endpoint should:
- ✅ Respond quickly (< 5 seconds recommended)
- ✅ Return 2xx status code on success
- ✅ Verify signature on every request
- ✅ Handle duplicate deliveries idempotently
- ✅ Use HTTPS (not HTTP)

### 2. Error Handling

```javascript
app.post('/webhook', async (req, res) => {
  try {
    // Verify signature first
    if (!verifySignature(req)) {
      return res.status(401).send('Invalid signature');
    }

    // Respond quickly
    res.status(200).send('OK');

    // Process asynchronously
    await processWebhookAsync(req.body);
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent retries
    res.status(200).send('Error logged');
  }
});
```

### 3. Idempotency

Use the delivery ID to prevent duplicate processing:

```javascript
const processedDeliveries = new Set();

app.post('/webhook', (req, res) => {
  const deliveryId = req.headers['x-webhook-delivery'];
  
  if (processedDeliveries.has(deliveryId)) {
    return res.status(200).send('Already processed');
  }

  // Process webhook...
  processedDeliveries.add(deliveryId);
  
  res.status(200).send('OK');
});
```

### 4. Monitoring

Monitor webhook health:
- Track success/failure rates
- Alert on consecutive failures
- Review delivery history regularly

## Testing Locally

### 1. Use ngrok or similar tunnel
```bash
ngrok http 3000
# Use the ngrok URL in your webhook configuration
```

### 2. Create test webhook
```bash
curl -X POST 'http://localhost:3000/api/v1/webhooks' \
  -H 'Authorization: Bearer your_api_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://abc123.ngrok.io/webhook",
    "events": ["note.created"],
    "description": "Local testing"
  }'
```

### 3. Trigger event
Create a note via API or UI, and watch your local server receive the webhook.

### 4. Test signature verification
```javascript
// Local test server
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('Received webhook:');
  console.log('Event:', req.body.event);
  console.log('Signature:', req.headers['x-webhook-signature']);
  
  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-webhook-signature'];
  const secret = 'your_webhook_secret';
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = 'sha256=' + hmac.digest('hex');
  
  console.log('Valid signature:', signature === expected);
  
  res.status(200).send('OK');
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
});
```

## Troubleshooting

### Webhook not firing

1. **Check webhook is active**
   ```bash
   curl https://smart-summarizer.app/api/v1/webhooks/webhook_id
   # Verify is_active: true
   ```

2. **Verify event subscription**
   - Ensure the event type is in the `events` array

3. **Check filters**
   - If filters are set, ensure the event matches filter criteria

### Deliveries failing

1. **Check endpoint URL**
   - Must be HTTPS
   - Must be publicly accessible
   - Must respond within timeout

2. **View delivery errors**
   ```bash
   curl 'https://smart-summarizer.app/api/v1/webhooks/webhook_id/deliveries?status=failed'
   ```

3. **Test webhook**
   ```bash
   curl -X POST 'https://smart-summarizer.app/api/v1/webhooks/webhook_id/test'
   ```

### Signature verification failing

1. **Use raw request body**
   - Don't parse JSON before verification
   - Verify against the exact bytes received

2. **Check secret**
   - Ensure you're using the correct secret from webhook creation

3. **Verify HMAC computation**
   - Use SHA-256 (not SHA-1 or MD5)
   - Prefix with 'sha256='

## Database Schema

### webhooks table
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  description TEXT,
  events TEXT[] NOT NULL,
  filters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 10,
  last_triggered_at TIMESTAMPTZ,
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### webhook_deliveries table
```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY,
  webhook_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Example Integrations

### Slack Notification

```javascript
// Slack webhook endpoint
app.post('/webhook/slack', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;

  if (event === 'note.created') {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `📝 New note created: ${data.summary}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Note Created*\n${data.summary}`
            }
          }
        ]
      })
    });
  }

  res.status(200).send('OK');
});
```

### Discord Notification

```javascript
app.post('/webhook/discord', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;

  if (event === 'note.created') {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '📝 New Note Created',
          description: data.summary,
          color: 0x00ff00,
          timestamp: new Date().toISOString()
        }]
      })
    });
  }

  res.status(200).send('OK');
});
```

### Email Notification

```javascript
const nodemailer = require('nodemailer');

app.post('/webhook/email', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;

  if (event === 'note.created') {
    await transporter.sendMail({
      from: 'notifications@example.com',
      to: 'user@example.com',
      subject: 'New note created',
      html: `
        <h2>New Note Created</h2>
        <p><strong>Summary:</strong> ${data.summary}</p>
        <p><strong>Created:</strong> ${data.created_at}</p>
      `
    });
  }

  res.status(200).send('OK');
});
```

## Rate Limits

Webhook management API endpoints follow the same rate limits as other API endpoints:
- Free: 100 requests/hour
- Personal: 1,000 requests/hour
- Pro: 10,000 requests/hour
- Team: 50,000 requests/hour

Webhook deliveries themselves are not rate limited.

## Support

Need help with webhooks?
- 📧 Email: api@smart-summarizer.app
- 📚 API Docs: https://smart-summarizer.app/api-docs
- 💬 Discord: https://discord.gg/smart-summarizer

---

**Last Updated**: November 2025  
**Webhooks Version**: 1.0.0
