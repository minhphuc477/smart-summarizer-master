/**
 * OpenAPI 3.0 specification for Smart Summarizer Public API
 * 
 * This file defines the complete API specification including:
 * - Authentication (Bearer token with API keys)
 * - Rate limiting headers
 * - All endpoint definitions with request/response schemas
 * - Error responses
 * - Data models
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Summarizer API',
    version: '1.0.0',
    description: `
# Smart Summarizer Public API

The Smart Summarizer API allows you to programmatically create, manage, and search your notes with AI-powered summaries.

## Authentication

All API requests require authentication using an API key. Include your API key in the Authorization header:

\`\`\`
Authorization: Bearer sk_live_your_api_key_here
\`\`\`

Get your API key from the dashboard at https://smart-summarizer.app/settings/api-keys

## Rate Limits

Rate limits are enforced per API key and vary by tier:

- **Free**: 100 requests/hour
- **Personal**: 1,000 requests/hour  
- **Pro**: 10,000 requests/hour
- **Team**: 50,000 requests/hour

Rate limit information is included in response headers:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Requests remaining in current window
- \`X-RateLimit-Reset\`: Unix timestamp when limit resets

## Errors

The API uses standard HTTP status codes:

- \`200\` - Success
- \`201\` - Created
- \`400\` - Bad Request (invalid parameters)
- \`401\` - Unauthorized (missing or invalid API key)
- \`403\` - Forbidden (insufficient permissions)
- \`404\` - Not Found
- \`429\` - Too Many Requests (rate limit exceeded)
- \`500\` - Internal Server Error

Error responses include a JSON body:
\`\`\`json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
\`\`\`
    `,
    contact: {
      name: 'API Support',
      email: 'api@smart-summarizer.app'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'https://smart-summarizer.app/api/v1',
      description: 'Production server'
    },
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'API key authentication. Get your key from the dashboard.'
      }
    },
    schemas: {
      Note: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique note identifier',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          user_id: {
            type: 'string',
            format: 'uuid',
            description: 'User who owns this note'
          },
          workspace_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Workspace this note belongs to'
          },
          folder_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Folder this note is organized in'
          },
          persona: {
            type: 'string',
            description: 'AI persona used for summarization',
            example: 'default'
          },
          original_notes: {
            type: 'string',
            description: 'Original text content',
            example: 'This is my meeting notes from today...'
          },
          summary: {
            type: 'string',
            description: 'AI-generated summary',
            example: 'Key discussion points included project timeline and budget.'
          },
          takeaways: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key takeaways extracted from content',
            example: ['Project deadline is Dec 15', 'Budget approved for Q1']
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string' },
                datetime: { type: 'string', format: 'date-time', nullable: true }
              }
            },
            description: 'Action items with optional due dates'
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral', 'mixed'],
            description: 'Overall sentiment analysis'
          },
          tags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' }
              }
            },
            description: 'Tags associated with this note'
          },
          is_pinned: {
            type: 'boolean',
            description: 'Whether note is pinned'
          },
          is_public: {
            type: 'boolean',
            description: 'Whether note is publicly shareable'
          },
          share_id: {
            type: 'string',
            nullable: true,
            description: 'Public share identifier'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        required: ['id', 'user_id', 'original_notes', 'summary', 'created_at']
      },
      NoteCreate: {
        type: 'object',
        properties: {
          original_notes: {
            type: 'string',
            description: 'Original text content to summarize',
            minLength: 1,
            example: 'Today we discussed the new project requirements...'
          },
          summary: {
            type: 'string',
            description: 'Pre-generated summary (if you want to provide your own)',
            minLength: 1
          },
          takeaways: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key takeaways',
            default: []
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string' },
                datetime: { type: 'string', format: 'date-time', nullable: true }
              }
            },
            description: 'Action items',
            default: []
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral', 'mixed'],
            description: 'Sentiment analysis result',
            default: 'neutral'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tag names (will be created if they don\'t exist)',
            example: ['meeting', 'project-alpha']
          },
          folder_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Folder to organize this note in'
          },
          workspace_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Workspace this note belongs to'
          },
          persona: {
            type: 'string',
            description: 'AI persona to use',
            default: 'default'
          }
        },
        required: ['original_notes', 'summary']
      },
      NoteUpdate: {
        type: 'object',
        properties: {
          original_notes: { type: 'string' },
          summary: { type: 'string' },
          takeaways: {
            type: 'array',
            items: { type: 'string' }
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string' },
                datetime: { type: 'string', format: 'date-time', nullable: true }
              }
            }
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral', 'mixed']
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tag names (replaces all existing tags)'
          },
          folder_id: {
            type: 'string',
            format: 'uuid',
            nullable: true
          },
          is_pinned: { type: 'boolean' },
          is_public: { type: 'boolean' }
        },
        description: 'All fields are optional - only provided fields will be updated'
      },
      NoteList: {
        type: 'object',
        properties: {
          notes: {
            type: 'array',
            items: { $ref: '#/components/schemas/Note' }
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 156 }
            }
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
            example: 'Invalid API key'
          },
          details: {
            type: 'string',
            description: 'Additional error context',
            example: 'API key has expired'
          }
        },
        required: ['error']
      }
    },
    parameters: {
      page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      limit: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page (max 100)',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      folderId: {
        name: 'folder_id',
        in: 'query',
        description: 'Filter by folder ID',
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      tag: {
        name: 'tag',
        in: 'query',
        description: 'Filter by tag name',
        schema: {
          type: 'string'
        }
      },
      sentiment: {
        name: 'sentiment',
        in: 'query',
        description: 'Filter by sentiment',
        schema: {
          type: 'string',
          enum: ['positive', 'negative', 'neutral', 'mixed']
        }
      },
      search: {
        name: 'search',
        in: 'query',
        description: 'Search in summary and original notes',
        schema: {
          type: 'string'
        }
      },
      sort: {
        name: 'sort',
        in: 'query',
        description: 'Sort field',
        schema: {
          type: 'string',
          enum: ['created_at', 'updated_at', 'summary'],
          default: 'created_at'
        }
      },
      order: {
        name: 'order',
        in: 'query',
        description: 'Sort order',
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc'
        }
      }
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid API key',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'Unauthorized',
              details: 'Invalid or expired API key'
            }
          }
        }
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'Forbidden',
              details: 'API key does not have required scope: notes:write'
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'Not found',
              details: 'Note with ID 123 not found'
            }
          }
        }
      },
      RateLimitExceeded: {
        description: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': {
            schema: { type: 'integer' },
            description: 'Maximum requests per hour'
          },
          'X-RateLimit-Remaining': {
            schema: { type: 'integer' },
            description: 'Remaining requests'
          },
          'X-RateLimit-Reset': {
            schema: { type: 'integer' },
            description: 'Unix timestamp when limit resets'
          }
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'Rate limit exceeded',
              details: 'You have exceeded your rate limit of 100 requests per hour'
            }
          }
        }
      },
      BadRequest: {
        description: 'Invalid request parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'Bad request',
              details: 'Missing required field: original_notes'
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/notes': {
      get: {
        summary: 'List notes',
        description: 'Retrieve a paginated list of your notes with optional filtering and sorting.',
        operationId: 'listNotes',
        tags: ['Notes'],
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/folderId' },
          { $ref: '#/components/parameters/tag' },
          { $ref: '#/components/parameters/sentiment' },
          { $ref: '#/components/parameters/search' },
          { $ref: '#/components/parameters/sort' },
          { $ref: '#/components/parameters/order' }
        ],
        responses: {
          '200': {
            description: 'List of notes',
            headers: {
              'X-RateLimit-Limit': {
                schema: { type: 'integer' },
                description: 'Rate limit for your tier'
              },
              'X-RateLimit-Remaining': {
                schema: { type: 'integer' },
                description: 'Requests remaining'
              },
              'X-RateLimit-Reset': {
                schema: { type: 'integer' },
                description: 'Reset timestamp'
              }
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NoteList' }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' }
        }
      },
      post: {
        summary: 'Create note',
        description: 'Create a new note with AI-generated summary and metadata.',
        operationId: 'createNote',
        tags: ['Notes'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NoteCreate' },
              example: {
                original_notes: 'Team meeting notes: Discussed Q4 roadmap, decided to prioritize mobile app launch.',
                summary: 'Q4 roadmap discussion with focus on mobile app prioritization.',
                takeaways: [
                  'Mobile app is top priority for Q4',
                  'Desktop features will be deferred',
                  'Budget approved for 2 additional mobile developers'
                ],
                actions: [
                  { task: 'Hire 2 mobile developers', datetime: '2025-11-15T00:00:00Z' },
                  { task: 'Create mobile app wireframes', datetime: null }
                ],
                sentiment: 'positive',
                tags: ['meeting', 'roadmap', 'q4'],
                folder_id: '123e4567-e89b-12d3-a456-426614174000'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Note created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Note' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' }
        }
      }
    },
    '/notes/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Note ID',
          schema: {
            type: 'string',
            format: 'uuid'
          }
        }
      ],
      get: {
        summary: 'Get note',
        description: 'Retrieve a specific note by ID.',
        operationId: 'getNote',
        tags: ['Notes'],
        responses: {
          '200': {
            description: 'Note details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Note' }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' }
        }
      },
      put: {
        summary: 'Update note',
        description: 'Update an existing note. Only provided fields will be updated.',
        operationId: 'updateNote',
        tags: ['Notes'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NoteUpdate' },
              example: {
                summary: 'Updated summary text',
                tags: ['meeting', 'important'],
                is_pinned: true
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Note updated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Note' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' }
        }
      },
      delete: {
        summary: 'Delete note',
        description: 'Permanently delete a note and all its associated data.',
        operationId: 'deleteNote',
        tags: ['Notes'],
        responses: {
          '200': {
            description: 'Note deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Note deleted successfully'
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' }
        }
      }
    }
  },
  tags: [
    {
      name: 'Notes',
      description: 'Operations for managing notes with AI-generated summaries'
    },
    {
      name: 'Webhooks',
      description: 'Manage webhook endpoints to receive real-time events'
    }
  ]
};
