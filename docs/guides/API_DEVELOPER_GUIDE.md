# Smart Summarizer API Developer Guide

This guide provides comprehensive documentation for developers integrating with the Smart Summarizer Public API.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Endpoints Reference](#endpoints-reference)
5. [Code Examples](#code-examples)
6. [Best Practices](#best-practices)
7. [Error Handling](#error-handling)
8. [Webhooks](#webhooks-coming-soon)

## Getting Started

### Base URL

All API requests should be made to:
```
https://smart-summarizer.app/api/v1
```

For local development:
```
http://localhost:3000/api/v1
```

### Getting an API Key

1. Sign in to your Smart Summarizer account
2. Navigate to **Settings → API Keys**
3. Click **Create New API Key**
4. Select the scopes you need:
   - `notes:read` - Read notes and search
   - `notes:write` - Create and update notes
   - `notes:delete` - Delete notes
   - `folders:read` - Read folders
   - `folders:write` - Create and update folders
5. Copy your API key immediately (it won't be shown again)

API keys follow the format: `sk_live_xxxxxxxxxxxxx` (live) or `sk_test_xxxxxxxxxxxxx` (test)

### Interactive Documentation

Visit https://smart-summarizer.app/api-docs for interactive API documentation powered by Swagger UI where you can test endpoints directly in your browser.

### OpenAPI Specification

Download the OpenAPI 3.0 specification:
```bash
curl https://smart-summarizer.app/api/v1/openapi.json > openapi.json
```

Import this file into tools like:
- Postman
- Insomnia
- VS Code REST Client extensions
- API testing frameworks

## Authentication

All API requests require authentication via Bearer token in the Authorization header:

```http
Authorization: Bearer sk_live_your_api_key_here
```

### Example Request

```bash
curl -X GET 'https://smart-summarizer.app/api/v1/notes' \
  -H 'Authorization: Bearer sk_live_abc123...'
```

### Security Best Practices

- ✅ **DO**: Store API keys in environment variables
- ✅ **DO**: Use different keys for development and production
- ✅ **DO**: Rotate keys regularly (every 90 days recommended)
- ✅ **DO**: Use the minimum required scopes
- ❌ **DON'T**: Commit API keys to version control
- ❌ **DON'T**: Share API keys in public channels
- ❌ **DON'T**: Embed keys in client-side code (mobile/web apps)

## Rate Limiting

Rate limits are enforced per API key and vary by subscription tier:

| Tier     | Requests/Hour | Requests/Day |
|----------|---------------|--------------|
| Free     | 100           | 1,000        |
| Personal | 1,000         | 10,000       |
| Pro      | 10,000        | 100,000      |
| Team     | 50,000        | 500,000      |

### Rate Limit Headers

Every API response includes rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1730476800
```

- `X-RateLimit-Limit`: Maximum requests allowed per hour
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

### Handling Rate Limits

When you exceed your rate limit, the API returns a `429 Too Many Requests` response:

```json
{
  "error": "Rate limit exceeded",
  "details": "You have exceeded your rate limit of 1000 requests per hour. Limit resets at 2025-11-01T18:00:00Z"
}
```

Implement exponential backoff:

```javascript
async function apiRequestWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const waitTime = Math.min(
        Math.pow(2, i) * 1000, // Exponential backoff
        (parseInt(resetTime) * 1000) - Date.now() // Wait until reset
      );
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}
```

## Endpoints Reference

### Notes

#### List Notes

```http
GET /api/v1/notes
```

**Query Parameters:**

| Parameter   | Type    | Description                          |
|-------------|---------|--------------------------------------|
| page        | integer | Page number (default: 1)             |
| limit       | integer | Items per page (max: 100, default: 20) |
| folder_id   | uuid    | Filter by folder                     |
| tag         | string  | Filter by tag name                   |
| sentiment   | enum    | Filter by sentiment (positive/negative/neutral/mixed) |
| search      | string  | Search in summary and original notes |
| sort        | enum    | Sort field (created_at/updated_at/summary) |
| order       | enum    | Sort order (asc/desc)                |

**Example:**

```bash
curl -X GET 'https://smart-summarizer.app/api/v1/notes?page=1&limit=20&tag=meeting&sort=created_at&order=desc' \
  -H 'Authorization: Bearer sk_live_abc123...'
```

**Response:**

```json
{
  "notes": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "user_id": "user_123",
      "original_notes": "Today we discussed...",
      "summary": "Key discussion points...",
      "takeaways": ["Point 1", "Point 2"],
      "actions": [
        {
          "task": "Follow up with client",
          "datetime": "2025-11-15T10:00:00Z"
        }
      ],
      "sentiment": "positive",
      "tags": [
        { "id": "tag_1", "name": "meeting" }
      ],
      "created_at": "2025-11-01T10:00:00Z",
      "updated_at": "2025-11-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156
  }
}
```

#### Create Note

```http
POST /api/v1/notes
```

**Required Scopes:** `notes:write`

**Request Body:**

```json
{
  "original_notes": "Meeting notes from today...",
  "summary": "Discussed project timeline and budget",
  "takeaways": [
    "Project deadline is Dec 15",
    "Budget approved for Q1"
  ],
  "actions": [
    {
      "task": "Send proposal to client",
      "datetime": "2025-11-10T14:00:00Z"
    }
  ],
  "sentiment": "positive",
  "tags": ["meeting", "project-alpha"],
  "folder_id": "folder_uuid",
  "persona": "default"
}
```

**Required Fields:**
- `original_notes` (string, min 1 character)
- `summary` (string, min 1 character)

**Optional Fields:**
- `takeaways` (array of strings)
- `actions` (array of objects with `task` and optional `datetime`)
- `sentiment` (enum: positive/negative/neutral/mixed, default: neutral)
- `tags` (array of tag names - will be created if they don't exist)
- `folder_id` (uuid)
- `workspace_id` (uuid)
- `persona` (string, default: 'default')

**Response:** `201 Created`

Returns the created note object with all fields populated.

#### Get Note

```http
GET /api/v1/notes/{id}
```

**Example:**

```bash
curl -X GET 'https://smart-summarizer.app/api/v1/notes/123e4567-e89b-12d3-a456-426614174000' \
  -H 'Authorization: Bearer sk_live_abc123...'
```

**Response:** `200 OK`

Returns the complete note object.

#### Update Note

```http
PUT /api/v1/notes/{id}
```

**Required Scopes:** `notes:write`

**Request Body:** (all fields optional - only provided fields will be updated)

```json
{
  "summary": "Updated summary text",
  "tags": ["meeting", "important"],
  "is_pinned": true,
  "sentiment": "positive"
}
```

**Response:** `200 OK`

Returns the updated note object.

#### Delete Note

```http
DELETE /api/v1/notes/{id}
```

**Required Scopes:** `notes:delete`

**Response:** `200 OK`

```json
{
  "message": "Note deleted successfully"
}
```

## Code Examples

### JavaScript/TypeScript

#### Basic Client

```typescript
class SmartSummarizerClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://smart-summarizer.app/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  async listNotes(params?: {
    page?: number;
    limit?: number;
    folderId?: string;
    tag?: string;
    sentiment?: string;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    return this.request<{ notes: Note[]; pagination: Pagination }>(
      `/notes?${queryParams}`
    );
  }

  async createNote(data: {
    original_notes: string;
    summary: string;
    takeaways?: string[];
    actions?: Array<{ task: string; datetime?: string }>;
    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
    tags?: string[];
    folder_id?: string;
  }) {
    return this.request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getNote(id: string) {
    return this.request<Note>(`/notes/${id}`);
  }

  async updateNote(id: string, data: Partial<Note>) {
    return this.request<Note>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNote(id: string) {
    return this.request<{ message: string }>(`/notes/${id}`, {
      method: 'DELETE',
    });
  }
}

// Usage
const client = new SmartSummarizerClient(process.env.SMART_SUMMARIZER_API_KEY!);

async function example() {
  // List notes
  const { notes, pagination } = await client.listNotes({
    tag: 'meeting',
    limit: 10
  });
  console.log(`Found ${pagination.total} notes`);

  // Create note
  const newNote = await client.createNote({
    original_notes: 'Meeting notes...',
    summary: 'Discussed project timeline',
    tags: ['meeting', 'project'],
    sentiment: 'positive'
  });
  console.log(`Created note: ${newNote.id}`);

  // Update note
  await client.updateNote(newNote.id, {
    is_pinned: true
  });

  // Delete note
  await client.deleteNote(newNote.id);
}
```

### Python

#### Basic Client

```python
import requests
from typing import List, Optional, Dict, Any
from datetime import datetime

class SmartSummarizerClient:
    def __init__(self, api_key: str, base_url: str = 'https://smart-summarizer.app/api/v1'):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[Any, Any]:
        response = self.session.request(
            method,
            f'{self.base_url}{endpoint}',
            **kwargs
        )
        response.raise_for_status()
        return response.json()

    def list_notes(
        self,
        page: int = 1,
        limit: int = 20,
        folder_id: Optional[str] = None,
        tag: Optional[str] = None,
        sentiment: Optional[str] = None,
        search: Optional[str] = None,
        sort: str = 'created_at',
        order: str = 'desc'
    ) -> Dict[str, Any]:
        params = {
            'page': page,
            'limit': limit,
            'sort': sort,
            'order': order
        }
        if folder_id:
            params['folder_id'] = folder_id
        if tag:
            params['tag'] = tag
        if sentiment:
            params['sentiment'] = sentiment
        if search:
            params['search'] = search

        return self._request('GET', '/notes', params=params)

    def create_note(
        self,
        original_notes: str,
        summary: str,
        takeaways: Optional[List[str]] = None,
        actions: Optional[List[Dict[str, Any]]] = None,
        sentiment: str = 'neutral',
        tags: Optional[List[str]] = None,
        folder_id: Optional[str] = None
    ) -> Dict[str, Any]:
        data = {
            'original_notes': original_notes,
            'summary': summary,
            'sentiment': sentiment
        }
        if takeaways:
            data['takeaways'] = takeaways
        if actions:
            data['actions'] = actions
        if tags:
            data['tags'] = tags
        if folder_id:
            data['folder_id'] = folder_id

        return self._request('POST', '/notes', json=data)

    def get_note(self, note_id: str) -> Dict[str, Any]:
        return self._request('GET', f'/notes/{note_id}')

    def update_note(self, note_id: str, **kwargs) -> Dict[str, Any]:
        return self._request('PUT', f'/notes/{note_id}', json=kwargs)

    def delete_note(self, note_id: str) -> Dict[str, Any]:
        return self._request('DELETE', f'/notes/{note_id}')

# Usage
import os

client = SmartSummarizerClient(os.environ['SMART_SUMMARIZER_API_KEY'])

# List notes with filtering
result = client.list_notes(tag='meeting', limit=10)
print(f"Found {result['pagination']['total']} notes")

# Create note
new_note = client.create_note(
    original_notes='Meeting notes from today...',
    summary='Discussed project timeline and deliverables',
    takeaways=['Deadline is Dec 15', 'Budget approved'],
    actions=[
        {'task': 'Send proposal', 'datetime': '2025-11-10T14:00:00Z'}
    ],
    tags=['meeting', 'project'],
    sentiment='positive'
)
print(f"Created note: {new_note['id']}")

# Update note
updated = client.update_note(new_note['id'], is_pinned=True)

# Delete note
client.delete_note(new_note['id'])
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "os"
)

type Client struct {
    apiKey  string
    baseURL string
    client  *http.Client
}

type Note struct {
    ID            string   `json:"id"`
    OriginalNotes string   `json:"original_notes"`
    Summary       string   `json:"summary"`
    Takeaways     []string `json:"takeaways"`
    Tags          []Tag    `json:"tags"`
    Sentiment     string   `json:"sentiment"`
    CreatedAt     string   `json:"created_at"`
}

type Tag struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}

func NewClient(apiKey string) *Client {
    return &Client{
        apiKey:  apiKey,
        baseURL: "https://smart-summarizer.app/api/v1",
        client:  &http.Client{},
    }
}

func (c *Client) doRequest(method, endpoint string, body interface{}) ([]byte, error) {
    var reqBody io.Reader
    if body != nil {
        jsonBody, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewBuffer(jsonBody)
    }

    req, err := http.NewRequest(method, c.baseURL+endpoint, reqBody)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Authorization", "Bearer "+c.apiKey)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    respBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("API error: %s", string(respBody))
    }

    return respBody, nil
}

func (c *Client) ListNotes(params map[string]string) ([]Note, error) {
    query := url.Values{}
    for k, v := range params {
        query.Add(k, v)
    }

    respBody, err := c.doRequest("GET", "/notes?"+query.Encode(), nil)
    if err != nil {
        return nil, err
    }

    var result struct {
        Notes []Note `json:"notes"`
    }
    if err := json.Unmarshal(respBody, &result); err != nil {
        return nil, err
    }

    return result.Notes, nil
}

func main() {
    client := NewClient(os.Getenv("SMART_SUMMARIZER_API_KEY"))
    
    notes, err := client.ListNotes(map[string]string{
        "tag": "meeting",
        "limit": "10",
    })
    if err != nil {
        panic(err)
    }

    fmt.Printf("Found %d notes\n", len(notes))
}
```

## Best Practices

### 1. Caching

Cache responses to reduce API calls:

```typescript
class CachedClient extends SmartSummarizerClient {
  private cache = new Map<string, { data: any; expires: number }>();

  async listNotes(params?: any) {
    const cacheKey = JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const data = await super.listNotes(params);
    this.cache.set(cacheKey, {
      data,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    return data;
  }
}
```

### 2. Batch Operations

When creating multiple notes, use batch processing with rate limit awareness:

```typescript
async function batchCreateNotes(client: SmartSummarizerClient, notes: any[]) {
  const results = [];
  const batchSize = 10;

  for (let i = 0; i < notes.length; i += batchSize) {
    const batch = notes.slice(i, i + batchSize);
    const promises = batch.map(note => client.createNote(note));
    
    try {
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    } catch (error) {
      if (error.message.includes('Rate limit')) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 60000));
        i -= batchSize; // Retry this batch
      } else {
        throw error;
      }
    }
  }

  return results;
}
```

### 3. Pagination

Handle large result sets efficiently:

```typescript
async function getAllNotes(client: SmartSummarizerClient) {
  const allNotes = [];
  let page = 1;
  const limit = 100; // Maximum allowed

  while (true) {
    const { notes, pagination } = await client.listNotes({ page, limit });
    allNotes.push(...notes);

    if (page * limit >= pagination.total) {
      break;
    }

    page++;
  }

  return allNotes;
}
```

### 4. Error Recovery

Implement robust error handling:

```typescript
async function safeApiCall<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.message.includes('400') || 
          error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('404')) {
        throw error;
      }

      // Exponential backoff for server errors and rate limits
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Verify API key |
| 403 | Forbidden | Check API key scopes |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limit | Implement backoff |
| 500 | Server Error | Retry with backoff |

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "details": "Additional context (optional)"
}
```

### Common Errors

#### Invalid API Key
```json
{
  "error": "Unauthorized",
  "details": "Invalid or expired API key"
}
```

**Solution**: Verify your API key is correct and hasn't expired.

#### Insufficient Permissions
```json
{
  "error": "Forbidden",
  "details": "API key does not have required scope: notes:write"
}
```

**Solution**: Create a new API key with the required scopes.

#### Rate Limit Exceeded
```json
{
  "error": "Rate limit exceeded",
  "details": "You have exceeded your rate limit of 1000 requests per hour"
}
```

**Solution**: Implement exponential backoff or upgrade your plan.

#### Resource Not Found
```json
{
  "error": "Not found",
  "details": "Note with ID 123 not found"
}
```

**Solution**: Verify the resource ID is correct and belongs to your account.

## Webhooks (Coming Soon)

Webhooks will allow you to receive real-time notifications when events occur. Planned events include:

- `note.created` - New note created
- `note.updated` - Note modified
- `note.deleted` - Note removed
- `folder.created` - New folder created
- `comment.created` - Comment added to note

Stay tuned for webhook documentation in a future release!

## Support

Need help with the API?

- 📧 Email: api@smart-summarizer.app
- 📚 Documentation: https://smart-summarizer.app/api-docs
- 💬 Discord: https://discord.gg/smart-summarizer
- 🐛 Issues: https://github.com/smart-summarizer/api-issues

---

**Last Updated**: November 2025  
**API Version**: 1.0.0
