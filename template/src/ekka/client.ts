/**
 * EKKA Client
 * DO NOT EDIT - Managed by EKKA
 *
 * Provides the connection interface for EKKA.
 * Uses the in-memory demo backend by default.
 * No network calls. No setup required.
 */

import * as demoBackend from './demo-backend';

// =============================================================================
// CONNECTION STATE
// =============================================================================

/**
 * Check if connected to the demo environment.
 */
export function isConnected(): boolean {
  return demoBackend.isConnected();
}

/**
 * Connect to the local demo environment.
 * No network calls - everything runs in memory.
 */
export async function connect(): Promise<void> {
  // Simulate async for API consistency
  await Promise.resolve();
  demoBackend.sessionOpen();
}

/**
 * Disconnect from the demo environment.
 */
export function disconnect(): void {
  demoBackend.sessionClose();
}
