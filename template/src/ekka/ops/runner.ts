/**
 * Runner Operations
 *
 * Local runner status for this desktop instance.
 */

import { _internal, makeRequest } from '../internal';

// =============================================================================
// TYPES
// =============================================================================

export type RunnerLoopState = 'running' | 'stopped' | 'error';

export interface RunnerStatus {
  enabled: boolean;
  state: RunnerLoopState;
  runnerId: string | null;
  engineUrl: string | null;
  lastPollAt: string | null;
  lastClaimAt: string | null;
  lastCompleteAt: string | null;
  lastTaskId: string | null;
  lastError: string | null;
}

// =============================================================================
// OPERATIONS
// =============================================================================

/**
 * Get local runner status for this desktop instance.
 */
export async function status(): Promise<RunnerStatus> {
  const req = makeRequest('runner.status', {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to get runner status');
  }

  return response.result as RunnerStatus;
}
