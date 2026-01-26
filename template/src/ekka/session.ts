/**
 * EKKA Session Management
 * DO NOT EDIT - Managed by EKKA
 *
 * Session bootstrap and lifecycle for local demo environment.
 */

import { connect, disconnect, isConnected } from './client';

export interface SessionInfo {
  connected: boolean;
}

/**
 * Get current session info.
 */
export function getSessionInfo(): SessionInfo {
  return {
    connected: isConnected(),
  };
}

export { connect, disconnect, isConnected };
