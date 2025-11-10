export type ApiErrorCode =
  | 'RATE_LIMIT'
  | 'GROQ_TIMEOUT'
  | 'GROQ_CONTENT_POLICY'
  | 'INVALID_INPUT'
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'EMBEDDINGS_UNAVAILABLE';

export function apiError(code: ApiErrorCode, message: string, details?: unknown) {
  return { error: message, code, details };
}

export function respondError(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return { body: apiError(code, message, details), status } as const;
}

export const ApiErrorMessages: Record<ApiErrorCode, string> = {
  RATE_LIMIT: 'You have exceeded your request rate. Please try again later.',
  GROQ_TIMEOUT: 'The AI service took too long to respond. Please retry.',
  GROQ_CONTENT_POLICY: 'The AI declined due to content policy. Try adjusting the input.',
  INVALID_INPUT: 'Your request was invalid. Check the input and try again.',
  AUTH_REQUIRED: 'Authentication is required for this request.',
  NOT_FOUND: 'The requested resource was not found.',
  INTERNAL: 'An unexpected error occurred. Please try again.',
  EMBEDDINGS_UNAVAILABLE: 'Embeddings are temporarily unavailable. Try keyword-only search.',
};
