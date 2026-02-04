/**
 * EKKA Type Definitions
 *
 * Core types for the EKKA client library.
 * Only includes types for IMPLEMENTED features.
 */

import { CONTRACT_VERSION } from './constants';

// =============================================================================
// CONTRACT TYPES
// =============================================================================

/**
 * Request format for all engine operations.
 */
export interface EngineRequest {
  op: string;
  v: number;
  payload: unknown;
  correlationId: string;
}

/**
 * Error detail in response.
 */
export interface EngineErrorDetail {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

/**
 * Response format for all engine operations.
 */
export interface EngineResponse {
  ok: boolean;
  result?: unknown;
  error?: EngineErrorDetail;
}

// =============================================================================
// CONTRACT HELPERS
// =============================================================================

/**
 * Generate a correlation ID (UUID v4).
 */
export function mkCorrelationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create an engine request.
 */
export function makeRequest(op: string, payload: unknown = {}): EngineRequest {
  return {
    op,
    v: CONTRACT_VERSION,
    payload,
    correlationId: mkCorrelationId(),
  };
}

/**
 * Create a successful response.
 */
export function ok<T = unknown>(result: T): EngineResponse {
  return { ok: true, result };
}

/**
 * Create an error response.
 */
export function err(code: string, message: string): EngineResponse {
  return { ok: false, error: { code, message } };
}
