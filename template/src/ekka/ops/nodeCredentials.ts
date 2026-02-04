/**
 * Node Credentials Operations
 *
 * Manages node_id + node_secret for headless engine startup.
 * Credentials are stored securely in OS keychain.
 *
 * ## Usage
 * 1. User provides node_id + node_secret once (onboarding)
 * 2. Credentials stored in OS keychain
 * 3. Engine uses them automatically on startup (no login required)
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

// =============================================================================
// TYPES
// =============================================================================

/** Input for setting node credentials */
export interface SetCredentialsInput {
  nodeId: string;
  nodeSecret: string;
}

/** Result from setting credentials */
export interface SetCredentialsResult {
  ok: boolean;
  nodeId: string;
}

/** Auth session info from node authentication */
export interface NodeAuthSession {
  sessionId: string;
  tenantId: string;
  workspaceId: string;
  expiresAt: string;
}

/** Credentials status */
export interface CredentialsStatus {
  hasCredentials: boolean;
  nodeId: string | null;
  isAuthenticated: boolean;
  authSession: NodeAuthSession | null;
}

// =============================================================================
// OPERATIONS
// =============================================================================

/**
 * Set node credentials.
 *
 * Stores node_id + node_secret in OS keychain.
 * Validates:
 * - node_id must be valid UUID
 * - node_secret must be non-empty and at least 16 characters
 *
 * @param input - { nodeId: UUID, nodeSecret: string }
 * @returns { ok: true, nodeId: string } on success
 * @throws Error if validation fails or keychain error
 */
export async function set(input: SetCredentialsInput): Promise<SetCredentialsResult> {
  const req = makeRequest(OPS.NODE_CREDENTIALS_SET, {
    nodeId: input.nodeId,
    nodeSecret: input.nodeSecret,
  });
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to store node credentials');
  }

  return response.result as SetCredentialsResult;
}

/**
 * Get credentials status.
 *
 * Returns whether credentials are configured and the node_id (if present).
 * Does NOT return the node_secret.
 */
export async function status(): Promise<CredentialsStatus> {
  const req = makeRequest(OPS.NODE_CREDENTIALS_STATUS, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to get credentials status');
  }

  return response.result as CredentialsStatus;
}

/**
 * Clear node credentials from OS keychain.
 *
 * @returns { ok: true } on success
 */
export async function clear(): Promise<{ ok: boolean }> {
  const req = makeRequest(OPS.NODE_CREDENTIALS_CLEAR, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to clear credentials');
  }

  return response.result as { ok: boolean };
}

/**
 * Validate node_id format (UUID).
 *
 * @param nodeId - String to validate
 * @returns true if valid UUID format
 */
export function isValidNodeId(nodeId: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(nodeId);
}

/**
 * Validate node_secret format.
 *
 * @param nodeSecret - String to validate
 * @returns true if valid (non-empty, at least 16 chars)
 */
export function isValidNodeSecret(nodeSecret: string): boolean {
  return nodeSecret.length >= 16;
}
