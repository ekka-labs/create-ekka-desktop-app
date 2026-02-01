/**
 * Home Operations
 *
 * Wraps Rust ops/home.rs
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

// =============================================================================
// Types
// =============================================================================

export type HomeState =
  | 'BOOTSTRAP_PRE_LOGIN'
  | 'AUTHENTICATED_NO_HOME_GRANT'
  | 'HOME_GRANTED';

export interface HomeStatus {
  state: HomeState;
  homePath: string;
  grantPresent: boolean;
  reason: string | null;
}

export interface GrantResult {
  success: boolean;
  grant_id: string;
  expires_at: string | null;
}

// =============================================================================
// Raw Operations (Advanced API)
// =============================================================================

/**
 * Get home directory status.
 * Maps to Rust: home.status
 */
export async function status(): Promise<HomeStatus> {
  const req = makeRequest(OPS.HOME_STATUS, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to get home status');
  }

  return response.result as HomeStatus;
}

/**
 * Request HOME grant from engine.
 * Maps to Rust: home.grant
 */
export async function grant(): Promise<GrantResult> {
  const req = makeRequest(OPS.HOME_GRANT, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to request grant');
  }

  return response.result as GrantResult;
}

// =============================================================================
// Simple Operations (Public API)
// =============================================================================

/**
 * Check if home is ready to use.
 * Simple boolean - no scary state machines.
 */
export async function isReady(): Promise<boolean> {
  try {
    const s = await status();
    return s.state === 'HOME_GRANTED';
  } catch {
    return false;
  }
}

/**
 * Set up home directory.
 * Does everything needed - checks status, requests grant if needed.
 * Just call this and you're done.
 */
export async function setup(): Promise<void> {
  const s = await status();

  if (s.state === 'HOME_GRANTED') {
    return; // Already ready
  }

  if (s.state === 'BOOTSTRAP_PRE_LOGIN') {
    throw new Error('Please login first before setting up home');
  }

  // State is AUTHENTICATED_NO_HOME_GRANT - request the grant
  await grant();
}
