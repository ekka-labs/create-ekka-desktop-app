/**
 * Setup Operations
 *
 * Pre-login setup status for device configuration.
 * Only checks node credentials - home folder grant is post-login.
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

// =============================================================================
// Types
// =============================================================================

export type SetupState = 'configured' | 'not_configured';

export interface SetupStatus {
  /** Node credentials status */
  nodeIdentity: SetupState;
  /** True if node credentials are configured */
  setupComplete: boolean;
}

// =============================================================================
// Operations
// =============================================================================

/**
 * Get setup status.
 *
 * Returns status of:
 * - nodeIdentity: configured | not_configured
 * - setupComplete: true if node credentials are configured
 *
 * This is called before login to determine if setup wizard is needed.
 * Home folder grant is handled post-login via HomeSetupPage.
 */
export async function status(): Promise<SetupStatus> {
  const req = makeRequest(OPS.SETUP_STATUS, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to get setup status');
  }

  return response.result as SetupStatus;
}
