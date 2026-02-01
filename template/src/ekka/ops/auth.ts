/**
 * Auth Operations
 *
 * Wraps Rust ops/auth.rs
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

export interface AuthContext {
  tenantId: string;
  sub: string;
  jwt: string;
  /** Workspace ID (required for node session registration) */
  workspaceId?: string;
}

/**
 * Set authentication context in engine.
 * Maps to Rust: auth.set
 */
export async function setContext(ctx: AuthContext): Promise<void> {
  const req = makeRequest(OPS.AUTH_SET, ctx);
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to set auth context');
  }
}
