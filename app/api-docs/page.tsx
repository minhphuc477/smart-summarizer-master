'use client';

import dynamic from 'next/dynamic';
import { openApiSpec } from '@/lib/openapi-spec';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

/**
 * API Documentation Page
 * 
 * Interactive API documentation powered by Swagger UI.
 * Displays all available endpoints, request/response schemas, and allows testing.
 */
export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Smart Summarizer API Documentation</h1>
          <p className="text-muted-foreground text-lg">
            Explore and test our REST API endpoints. Get your API key from{' '}
            <a href="/settings/api-keys" className="text-primary hover:underline">
              Settings → API Keys
            </a>
            .
          </p>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <SwaggerUI 
            spec={openApiSpec}
            docExpansion="list"
            defaultModelsExpandDepth={1}
            defaultModelExpandDepth={1}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            tryItOutEnabled={true}
          />
        </div>

        <div className="mt-12 prose dark:prose-invert max-w-none">
          <h2>Quick Start Guide</h2>
          
          <h3>1. Get Your API Key</h3>
          <p>
            Navigate to <a href="/settings/api-keys">Settings → API Keys</a> and create a new API key.
            Choose the appropriate scopes for your use case:
          </p>
          <ul>
            <li><code>notes:read</code> - Read notes and search</li>
            <li><code>notes:write</code> - Create and update notes</li>
            <li><code>notes:delete</code> - Delete notes</li>
          </ul>

          <h3>2. Make Your First Request</h3>
          <p>Here&apos;s a simple example using curl to list your notes:</p>
          <pre><code>{`curl -X GET 'https://smart-summarizer.app/api/v1/notes' \\
  -H 'Authorization: Bearer sk_live_your_api_key_here'`}</code></pre>

          <h3>3. Create a Note</h3>
          <p>Create a new note with AI-generated summary:</p>
          <pre><code>{`curl -X POST 'https://smart-summarizer.app/api/v1/notes' \\
  -H 'Authorization: Bearer sk_live_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "original_notes": "Meeting with client about new features...",
    "summary": "Client requested mobile app and offline mode",
    "tags": ["meeting", "client"],
    "sentiment": "positive"
  }'`}</code></pre>

          <h3>4. Handle Rate Limits</h3>
          <p>
            Monitor rate limit headers in responses:
          </p>
          <ul>
            <li><code>X-RateLimit-Limit</code> - Your hourly limit</li>
            <li><code>X-RateLimit-Remaining</code> - Requests remaining</li>
            <li><code>X-RateLimit-Reset</code> - When limit resets (Unix timestamp)</li>
          </ul>

          <h3>5. Error Handling</h3>
          <p>All errors return a JSON response with an <code>error</code> field:</p>
          <pre><code>{`{
  "error": "Rate limit exceeded",
  "details": "You have exceeded your rate limit of 100 requests per hour"
}`}</code></pre>

          <h2>Code Examples</h2>

          <h3>JavaScript/TypeScript</h3>
          <pre><code>{`const API_KEY = 'sk_live_your_api_key_here';
const BASE_URL = 'https://smart-summarizer.app/api/v1';

async function listNotes() {
  const response = await fetch(\`\${BASE_URL}/notes\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`
    }
  });
  
  if (!response.ok) {
    throw new Error(\`API error: \${response.status}\`);
  }
  
  const data = await response.json();
  return data.notes;
}

async function createNote(content: string, summary: string) {
  const response = await fetch(\`\${BASE_URL}/notes\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      original_notes: content,
      summary: summary,
      tags: ['api-created'],
      sentiment: 'neutral'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return response.json();
}`}</code></pre>

          <h3>Python</h3>
          <pre><code>{`import requests

API_KEY = 'sk_live_your_api_key_here'
BASE_URL = 'https://smart-summarizer.app/api/v1'

def list_notes():
    response = requests.get(
        f'{BASE_URL}/notes',
        headers={'Authorization': f'Bearer {API_KEY}'}
    )
    response.raise_for_status()
    return response.json()['notes']

def create_note(content, summary, tags=None):
    response = requests.post(
        f'{BASE_URL}/notes',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'original_notes': content,
            'summary': summary,
            'tags': tags or [],
            'sentiment': 'neutral'
        }
    )
    response.raise_for_status()
    return response.json()

# Example usage
notes = list_notes()
print(f'Found {len(notes)} notes')

new_note = create_note(
    'Meeting notes from today...',
    'Discussed project timeline',
    tags=['meeting', 'project']
)
print(f'Created note: {new_note["id"]}')`}</code></pre>

          <h2>Best Practices</h2>
          <ul>
            <li>Always use HTTPS for API requests</li>
            <li>Store API keys securely (use environment variables)</li>
            <li>Implement exponential backoff for rate limit errors</li>
            <li>Cache responses when appropriate to reduce API calls</li>
            <li>Use pagination for large result sets</li>
            <li>Monitor rate limit headers to avoid hitting limits</li>
            <li>Handle errors gracefully with proper try/catch blocks</li>
          </ul>

          <h2>Support</h2>
          <p>
            Need help? Contact us at <a href="mailto:api@smart-summarizer.app">api@smart-summarizer.app</a>
            {' '}or visit our <a href="https://github.com/smart-summarizer/docs">documentation on GitHub</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
