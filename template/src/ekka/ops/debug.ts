/**
 * Debug Operations
 *
 * Utility operations for development and debugging.
 * Only available when EKKA_ENV=development.
 */

import { _internal, makeRequest } from '../internal';

// =============================================================================
// Types
// =============================================================================

export interface DebugBundleInfo {
  debug_bundle_ref: string;
  raw_output_sha256: string;
  raw_output_len: number;
  files: string[];
}

export interface ResolvedVaultPath {
  vaultUri: string;
  filesystemPath: string;
  exists: boolean;
}

// =============================================================================
// Operations
// =============================================================================

/**
 * Check if running in development mode.
 */
export async function isDevMode(): Promise<boolean> {
  const req = makeRequest('debug.isDevMode', {});
  const response = await _internal.request(req);
  const result = response.result as { isDevMode?: boolean } | undefined;
  return result?.isDevMode ?? false;
}

/**
 * Open a folder in the system file browser.
 * Only works in development mode.
 *
 * @param path - Path to open (supports vault:// URIs)
 */
export async function openFolder(path: string): Promise<void> {
  const req = makeRequest('debug.openFolder', { path });
  const response = await _internal.request(req);
  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to open folder');
  }
}

/**
 * Resolve a vault:// URI to filesystem path.
 * Only works in development mode.
 *
 * @param vaultUri - Vault URI (e.g., "vault://tmp/telemetry/...")
 */
export async function resolveVaultPath(vaultUri: string): Promise<ResolvedVaultPath> {
  const req = makeRequest('debug.resolveVaultPath', { path: vaultUri });
  const response = await _internal.request(req);
  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to resolve vault path');
  }
  return response.result as ResolvedVaultPath;
}
