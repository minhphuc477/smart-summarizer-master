/**
 * Authenticated fetch wrapper for API calls
 * Ensures credentials (cookies) are included in requests
 */

type FetchOptions = RequestInit & {
  body?: unknown;
};

/**
 * Make an authenticated API request
 * Automatically includes credentials and handles JSON
 */
export async function apiFetch(url: string, options: FetchOptions = {}) {
  const { body, headers = {}, ...restOptions } = options;

  const fetchOptions: RequestInit = {
    ...restOptions,
    credentials: 'same-origin', // Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body) as BodyInit;
  }

  const response = await fetch(url, fetchOptions);
  
  // Try to parse JSON response
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Throw error with parsed data
    const error = new Error(
      data?.error || data?.message || `API Error: ${response.status}`
    ) as Error & { status: number; data: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: (url: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiFetch(url, { ...options, method: 'GET' }),

  post: (url: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiFetch(url, { ...options, method: 'POST', body: body as FetchOptions['body'] }),

  put: (url: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiFetch(url, { ...options, method: 'PUT', body: body as FetchOptions['body'] }),

  patch: (url: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiFetch(url, { ...options, method: 'PATCH', body: body as FetchOptions['body'] }),

  delete: (url: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiFetch(url, { ...options, method: 'DELETE' }),
};
