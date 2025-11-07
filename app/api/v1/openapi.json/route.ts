import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi-spec';

/**
 * GET /api/v1/openapi.json
 * 
 * Returns the OpenAPI 3.0 specification as JSON.
 * This endpoint can be used with tools like Postman, Insomnia, or other API clients
 * that support importing OpenAPI specifications.
 * 
 * This endpoint is public (no authentication required) to allow easy discovery.
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    }
  });
}
