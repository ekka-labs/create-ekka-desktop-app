/**
 * HTTP Client with Security Envelope
 *
 * All requests to EKKA API must include security envelope headers.
 * This module provides the foundation for all API communication.
 *
 * Pattern adapted from apps/ui/src/sdk/auth.ts
 */

import { API_BASE_URL, CLIENT_TYPE, CLIENT_VERSION } from '../config';

// =============================================================================
// TYPES
// =============================================================================

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  module: string;
  action: string;
}

export interface ApiErrorData {
  error?: string;
  message?: string;
  code?: string;
  missing?: string[];
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * API request error with status code and error details.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly data?: ApiErrorData;

  constructor(message: string, status: number, code: string, data?: ApiErrorData) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// =============================================================================
// SECURITY ENVELOPE
// =============================================================================

/**
 * Build security envelope headers for API requests.
 *
 * All EKKA API requests require these 7 headers:
 * - X-EKKA-PROOF-TYPE: 'none' (unauthenticated) or 'jwt' (authenticated)
 * - X-REQUEST-ID: Unique request identifier
 * - X-EKKA-CORRELATION-ID: Trace correlation ID
 * - X-EKKA-MODULE: Calling module identifier
 * - X-EKKA-ACTION: Action being performed
 * - X-EKKA-CLIENT: Client type ('desktop')
 * - X-EKKA-CLIENT-VERSION: Client version
 */
export function buildSecurityHeaders(
  module: string,
  action: string,
  jwt: string | null
): Record<string, string> {
  const correlationId = crypto.randomUUID();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-REQUEST-ID': correlationId,
    'X-EKKA-CORRELATION-ID': correlationId,
    'X-EKKA-PROOF-TYPE': jwt ? 'jwt' : 'none',
    'X-EKKA-MODULE': module,
    'X-EKKA-ACTION': action,
    'X-EKKA-CLIENT': CLIENT_TYPE,
    'X-EKKA-CLIENT-VERSION': CLIENT_VERSION,
  };

  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  return headers;
}

// =============================================================================
// REQUEST FUNCTION
// =============================================================================

/**
 * Make an API request with security envelope headers.
 *
 * @param path - API endpoint path (e.g., '/auth/login')
 * @param options - Request options including module and action
 * @param jwt - Optional JWT for authenticated requests
 * @returns Typed response data
 * @throws ApiRequestError on failure
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions,
  jwt: string | null = null
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = buildSecurityHeaders(options.module, options.action, jwt);
  const method = options.method || 'GET';

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorData: ApiErrorData = await response.json().catch(() => ({}));
    const message = errorData.message || errorData.error || `Request failed: ${response.status}`;
    const code = errorData.code || 'API_ERROR';
    throw new ApiRequestError(message, response.status, code, errorData);
  }

  return response.json();
}
