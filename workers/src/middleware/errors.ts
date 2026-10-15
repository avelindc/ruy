/**
 * BREAKOUT MUSIC — Error Handling Middleware
 *
 * Standardized error responses across all API endpoints.
 */

import type { ApiResponse } from '../types/database';
import { DatabaseError, NotFoundError, ValidationError, AuthenticationError } from '../types/database';

export interface ErrorResponse extends ApiResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * Convert error to standardized API response
 */
export function handleError(error: unknown): ErrorResponse {
  // Database-specific errors
  if (error instanceof DatabaseError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    };
  }

  if (error instanceof NotFoundError) {
    return {
      success: false,
      error: error.message,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    };
  }

  if (error instanceof ValidationError) {
    return {
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      success: false,
      error: error.message,
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  // Generic errors
  if (error instanceof Error) {
    console.error('Unhandled error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  console.error('Unknown error:', error);
  return {
    success: false,
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get HTTP status code for error
 */
export function getStatusCode(error: unknown): number {
  if (error instanceof DatabaseError) {
    return error.statusCode;
  }

  if (error instanceof NotFoundError) {
    return 404;
  }

  if (error instanceof ValidationError) {
    return 400;
  }

  if (error instanceof AuthenticationError) {
    return 401;
  }

  return 500; // Internal server error
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      const errorResponse = handleError(error);
      const statusCode = getStatusCode(error);

      return new Response(JSON.stringify(errorResponse), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
