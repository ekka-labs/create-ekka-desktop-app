/**
 * Node Session Operations
 *
 * Wraps Rust node_auth module for Ed25519-based node authentication.
 *
 * ## Flow
 * 1. ensureIdentity() - Create/load Ed25519 keypair (no auth required)
 * 2. bootstrap({ startRunner: true }) - Register with engine + start runner
 * 3. status() - Check current identity and session state
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

// =============================================================================
// TYPES
// =============================================================================

/** Node identity (public metadata - safe to log) */
export interface NodeIdentity {
  node_id: string;
  public_key_b64: string;
  private_key_vault_ref: string;
  created_at: string;
}

/** Result from ensureIdentity */
export interface EnsureIdentityResult {
  ok: boolean;
  node_id: string;
  public_key_b64: string;
  private_key_vault_ref: string;
  created_at: string;
}

/** Options for bootstrap */
export interface BootstrapOptions {
  /** Start the runner after session is established (default: false) */
  startRunner?: boolean;
}

/** Session info from bootstrap */
export interface SessionInfo {
  session_id: string;
  tenant_id: string;
  workspace_id: string;
  expires_at: string;
}

/** Result from bootstrap */
export interface BootstrapResult {
  ok: boolean;
  node_id: string;
  public_key_b64: string;
  registered: boolean;
  session?: SessionInfo;
}

/** Node session status */
export interface NodeSessionStatus {
  hasIdentity: boolean;
  hasSession: boolean;
  sessionValid: boolean;
  identity?: {
    node_id: string;
    public_key_b64: string;
    created_at: string;
  };
  session?: {
    session_id: string;
    tenant_id: string;
    workspace_id: string;
    expires_at: string;
    is_expired: boolean;
  };
}

// =============================================================================
// OPERATIONS
// =============================================================================

/**
 * Ensure node identity exists (load or create keypair).
 *
 * Creates Ed25519 keypair if none exists.
 * Does NOT require authentication.
 *
 * Call this during app startup before login.
 */
export async function ensureIdentity(): Promise<EnsureIdentityResult> {
  const req = makeRequest(OPS.NODE_SESSION_ENSURE_IDENTITY, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to ensure node identity');
  }

  return response.result as EnsureIdentityResult;
}

/**
 * Bootstrap full node session.
 *
 * 1. Ensures identity exists
 * 2. Registers node with engine (idempotent)
 * 3. Gets challenge from engine
 * 4. Signs challenge with Ed25519 private key
 * 5. Exchanges signature for session token
 * 6. Optionally starts the runner
 *
 * REQUIRES: User must be logged in (JWT required for registration).
 */
export async function bootstrap(options?: BootstrapOptions): Promise<BootstrapResult> {
  const req = makeRequest(OPS.NODE_SESSION_BOOTSTRAP, {
    startRunner: options?.startRunner ?? false,
  });
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to bootstrap node session');
  }

  return response.result as BootstrapResult;
}

/**
 * Get current node session status.
 *
 * Returns:
 * - hasIdentity: Whether Ed25519 keypair exists
 * - hasSession: Whether session token exists
 * - sessionValid: Whether session is not expired
 * - identity: Node identity metadata
 * - session: Session metadata including expiry
 */
export async function status(): Promise<NodeSessionStatus> {
  const req = makeRequest(OPS.NODE_SESSION_STATUS, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to get node session status');
  }

  return response.result as NodeSessionStatus;
}
