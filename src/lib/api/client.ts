/**
 * API Client for Cloudflare Workers Backend
 * Handles authentication, base URL, and standardized fetch with error handling
 */

import { getApiBaseUrl } from '@config/apiConfig';

const API_URL = getApiBaseUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  status?: number;
  code?: string;
  response?: ApiResponse;

  constructor(message: string, status?: number, code?: string, response?: ApiResponse) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.response = response;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Get authorization headers with current user's JWT token
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Make an API request to the Workers backend
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;
  const headers = await getAuthHeaders();

  const config: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(url, config);
    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      if (
        response.status === 401 &&
        data.code === 'AUTH_ERROR' &&
        !endpoint.endsWith('/auth/me') &&
        !endpoint.startsWith('/auth/') &&
        !endpoint.startsWith('/api/auth/')
      ) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-logout', { detail: { reason: 'invalid_session' } }));
        }
      }
      const error = new ApiError(data.error || 'API request failed', response.status, data.code, data);
      throw error;
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const apiError = new ApiError(
      error instanceof Error ? error.message : 'Unknown API error',
      500
    );
    throw apiError;
  }
}

/**
 * GET request helper
 */
export async function apiGet<T = any>(
  endpoint: string,
  options?: Omit<RequestInit, 'method'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST request helper
 */
export async function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T = any>(
  endpoint: string,
  body?: any,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = any>(
  endpoint: string,
  options?: Omit<RequestInit, 'method'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Check if API is available (health check)
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export default {
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  getAuthHeaders,
  checkApiHealth,
  API_URL,
};
