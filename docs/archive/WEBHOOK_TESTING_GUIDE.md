# How to Create and Test Webhooks

## What is a Webhook?

A webhook is a way for your app to send real-time notifications to external services when certain events happen (like creating a note, uploading a PDF, etc.).

---

## Step 1: Create a Webhook Endpoint to Receive Data

You need a URL that can receive POST requests. Here are your options:

### Option A: Use webhook.site (Easiest - for testing)

1. Go to https://webhook.site
2. You'll see a unique URL like: `https://webhook.site/12345678-abcd-1234-abcd-123456789012`
3. Copy this URL - this is your webhook endpoint
4. Leave the page open - you'll see incoming webhooks here in real-time

### Option B: Use RequestBin

1. Go to https://requestbin.com
2. Click "Create a Request Bin"
3. Copy the URL provided
4. You'll see all incoming requests on this page

### Option C: Use ngrok (For local development)

1. Install ngrok: https://ngrok.com/download
2. Run your local server (e.g., `node server.js` on port 3000)
3. Run: `ngrok http 3000`
4. Copy the HTTPS URL shown (e.g., `https://abc123.ngrok.io`)
5. Use this URL + your endpoint path (e.g., `https://abc123.ngrok.io/webhook`)

### Option D: Create Your Own Endpoint (Advanced)

Simple Express.js example:
```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  console.log('Headers:', req.headers);
  
  // Verify signature if your app sends one
  const signature = req.headers['x-webhook-signature'];
  
  res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

---

## Step 2: Create a Webhook in Smart Summarizer

1. **Go to Webhooks Section**
   - Navigate to the webhooks page in your app
   - Or directly visit: `http://localhost:3000/webhooks` (or your app URL)

2. **Click "Create Webhook"**

3. **Fill in the form:**
   - **URL**: Paste the endpoint URL from Step 1
     - Example: `https://webhook.site/12345678-abcd-1234-abcd-123456789012`
   - **Events**: Select which events trigger the webhook
     - ✅ `note.created` - When a new note is created
     - ✅ `note.updated` - When a note is edited
     - ✅ `note.deleted` - When a note is deleted
     - ✅ `pdf.uploaded` - When a PDF is uploaded
     - ✅ `pdf.processed` - When PDF processing completes
     - ✅ `workspace.created` - When a workspace is created
   - **Enabled**: ✅ Make sure this is checked

4. **Click "Create"**

You should see your webhook in the list with a green "Active" badge.

---

## Step 3: Test Your Webhook

### Method A: Use the Test Button

1. Find your webhook in the list
2. Click the "Test" button (▶️ icon)
3. Check your webhook receiver (webhook.site or your endpoint)
4. You should see a test payload like:

```json
{
  "event": "webhook.test",
  "timestamp": "2025-11-10T12:34:56.789Z",
  "data": {
    "test": true,
    "message": "This is a test webhook"
  }
}
```

### Method B: Trigger a Real Event

**To test `note.created`:**
1. Go to the main summarizer page
2. Type some notes
3. Click "Summarize"
4. Check your webhook receiver - you should see:

```json
{
  "event": "note.created",
  "timestamp": "2025-11-10T12:34:56.789Z",
  "data": {
    "id": 123,
    "user_id": "user-uuid-here",
    "summary": "Your note summary",
    "original_notes": "Your original text",
    "persona": "professional",
    "tags": ["tag1", "tag2"],
    "sentiment": "positive",
    "created_at": "2025-11-10T12:34:56.789Z"
  }
}
```

**To test `pdf.uploaded`:**
1. Go to PDF section
2. Upload a PDF file
3. Check your webhook receiver for the upload event

---

## Step 4: Verify Webhook Signature (Security)

When your app sends webhooks, it includes a signature in the `x-webhook-signature` header. Verify it like this:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook endpoint:
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = 'your-webhook-secret-from-app'; // Get this from webhook settings
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  console.log('Valid webhook:', req.body);
  res.status(200).json({ received: true });
});
```

---

## Step 5: Monitor and Debug

### Check Webhook Logs

Your app might show webhook delivery history:
- ✅ Success (200 OK)
- ⚠️ Retry (503, 504)
- ❌ Failed (400, 401, 500)

### Common Issues

**1. "Connection timeout"**
- Solution: Your endpoint might be slow or unreachable
- Check if the URL is correct and accessible

**2. "Invalid signature"**
- Solution: Make sure you're using the correct secret
- Verify signature calculation matches the app's method

**3. "404 Not Found"**
- Solution: Check the endpoint path is correct
- Ensure your server is running

**4. "SSL certificate error"**
- Solution: Use a valid HTTPS URL
- For testing, use webhook.site or ngrok

---

## Example Webhook Payloads

### Note Created
```json
{
  "event": "note.created",
  "timestamp": "2025-11-10T12:00:00Z",
  "data": {
    "id": 123,
    "user_id": "abc123",
    "summary": "Meeting notes summary",
    "original_notes": "Raw meeting notes...",
    "persona": "professional",
    "tags": ["meeting", "work"],
    "sentiment": "neutral",
    "takeaways": ["Key point 1", "Key point 2"],
    "actions": [
      {
        "task": "Follow up with team",
        "datetime": "2025-11-15T10:00:00Z"
      }
    ]
  }
}
```

### PDF Processed
```json
{
  "event": "pdf.processed",
  "timestamp": "2025-11-10T12:00:00Z",
  "data": {
    "id": "pdf-uuid",
    "filename": "document.pdf",
    "status": "completed",
    "page_count": 10,
    "file_size": 1024000,
    "full_text": "Extracted text...",
    "workspace_id": "workspace-uuid",
    "folder_id": 5
  }
}
```

### Workspace Created
```json
{
  "event": "workspace.created",
  "timestamp": "2025-11-10T12:00:00Z",
  "data": {
    "id": "workspace-uuid",
    "name": "Team Workspace",
    "description": "Our team's workspace",
    "owner_id": "user-uuid",
    "created_at": "2025-11-10T12:00:00Z"
  }
}
```

---

## Integration Examples

### Send to Slack
```javascript
app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'note.created') {
    await fetch('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New note created: ${data.summary}`,
        attachments: [{
          color: 'good',
          fields: [
            { title: 'Tags', value: data.tags.join(', '), short: true },
            { title: 'Sentiment', value: data.sentiment, short: true }
          ]
        }]
      })
    });
  }
  
  res.status(200).json({ received: true });
});
```

### Send to Discord
```javascript
app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'pdf.processed') {
    await fetch('https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '📄 PDF Processed',
          description: `**${data.filename}** (${data.page_count} pages)`,
          color: 0x00ff00,
          timestamp: new Date().toISOString()
        }]
      })
    });
  }
  
  res.status(200).json({ received: true });
});
```

### Save to Database
```javascript
app.post('/webhook', async (req, res) => {
  const { event, timestamp, data } = req.body;
  
  // Save to your database
  await db.query(
    'INSERT INTO webhook_events (event_type, event_data, received_at) VALUES ($1, $2, $3)',
    [event, JSON.stringify(data), timestamp]
  );
  
  res.status(200).json({ received: true });
});
```

---

## Troubleshooting

### Webhook not firing?
1. Check if webhook is enabled (green badge)
2. Verify the event type is selected
3. Check webhook URL is correct
4. Look for errors in app logs

### Getting errors?
1. Check your endpoint returns 200 OK
2. Verify endpoint accepts POST requests
3. Check endpoint accepts JSON content-type
4. Test endpoint manually with curl:

```bash
curl -X POST https://your-endpoint.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Need to retry failed webhooks?
Most webhook systems have retry logic:
- 1st retry: After 1 minute
- 2nd retry: After 5 minutes
- 3rd retry: After 15 minutes
- After 3 failures: Marked as failed

---

## Best Practices

1. **Always return 200 OK quickly** (< 5 seconds)
   - Process async if needed
   - Don't block the response

2. **Verify signatures** for security
   - Prevent unauthorized webhooks
   - Use HMAC-SHA256

3. **Handle duplicates gracefully**
   - Same webhook might be sent twice
   - Use idempotency keys

4. **Log everything** for debugging
   - Save raw webhook payload
   - Track processing status

5. **Set up monitoring**
   - Alert on failed webhooks
   - Track delivery rates

---

## Quick Test Checklist

- [ ] Created webhook in app
- [ ] Webhook URL is correct
- [ ] Events are selected
- [ ] Webhook is enabled
- [ ] Tested with test button
- [ ] Triggered real event
- [ ] Received payload in webhook receiver
- [ ] Verified signature (if implemented)
- [ ] Endpoint returns 200 OK
- [ ] Webhook shows as successful in logs

---

Need help? Check the app's webhook logs for detailed error messages!
