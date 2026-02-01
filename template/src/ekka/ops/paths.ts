/**
 * Path Operations
 *
 * Wraps Rust handlers/paths.rs
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

// =============================================================================
// Types
// =============================================================================

export type PathType =
  | 'GENERAL'
  | 'WORKSPACE'
  | 'DATA'
  | 'TEMP'
  | 'CACHE'
  | 'HOME';

export type PathAccess = 'READ_ONLY' | 'READ_WRITE';

export interface PathInfo {
  path: string;
  pathType: PathType;
  access: PathAccess;
  grantId: string;
  expiresAt: string | null;
  isValid: boolean;
  /** Who issued the grant (e.g., "ekka-engine") */
  issuer: string;
  /** When the grant was issued (RFC3339) */
  issuedAt: string;
  /** User/subject who owns the grant */
  subject: string;
  /** Tenant ID */
  tenantId: string;
  /** Purpose of the grant */
  purpose: string;
}

export interface PathCheckResult {
  allowed: boolean;
  reason: string;
  pathType: PathType | null;
  access: PathAccess | null;
  /** The path prefix that granted access (use this for revoke) */
  grantedBy: string | null;
}

export interface PathGrantResult {
  success: boolean;
  grantId: string | null;
  expiresAt: string | null;
  error: string | null;
}

export interface PathRequestOptions {
  pathType?: PathType;
  access?: PathAccess;
}

// =============================================================================
// Raw Operations (Advanced API)
// =============================================================================

/**
 * Check if an operation is allowed on a path.
 * Maps to Rust: paths.check
 */
export async function check(
  path: string,
  operation: string = 'read'
): Promise<PathCheckResult> {
  const req = makeRequest(OPS.PATHS_CHECK, { path, operation });
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to check path');
  }

  return response.result as PathCheckResult;
}

/**
 * List all path grants.
 * Maps to Rust: paths.list
 */
export async function list(pathType?: PathType): Promise<PathInfo[]> {
  const req = makeRequest(OPS.PATHS_LIST, { pathType });
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to list paths');
  }

  const result = response.result as { paths: PathInfo[] };
  return result.paths;
}

/**
 * Get information about a specific path.
 * Maps to Rust: paths.get
 */
export async function get(path: string): Promise<PathInfo | null> {
  const req = makeRequest(OPS.PATHS_GET, { path });
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to get path');
  }

  return response.result as PathInfo | null;
}

/**
 * Request access to a path.
 * Maps to Rust: paths.request
 */
export async function request(
  path: string,
  pathType: PathType = 'GENERAL',
  access: PathAccess = 'READ_ONLY'
): Promise<PathGrantResult> {
  const req = makeRequest(OPS.PATHS_REQUEST, { path, pathType, access });
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to request path access');
  }

  return response.result as PathGrantResult;
}

/**
 * Remove a path grant.
 * Maps to Rust: paths.remove
 */
export async function remove(path: string): Promise<boolean> {
  const req = makeRequest(OPS.PATHS_REMOVE, { path });
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to remove path');
  }

  const result = response.result as { removed: boolean };
  return result.removed;
}

// =============================================================================
// Simple Operations (Public API)
// =============================================================================

/**
 * Check if an operation is allowed on a path.
 * Simple boolean - no scary details.
 */
export async function isAllowed(
  path: string,
  operation: string = 'read'
): Promise<boolean> {
  try {
    const result = await check(path, operation);
    return result.allowed;
  } catch {
    return false;
  }
}

/**
 * Allow access to a path.
 * Simple wrapper for request with sensible defaults.
 */
export async function allow(
  path: string,
  options?: PathRequestOptions
): Promise<PathGrantResult> {
  const pathType = options?.pathType || 'WORKSPACE';
  const access = options?.access || 'READ_WRITE';
  return request(path, pathType, access);
}
