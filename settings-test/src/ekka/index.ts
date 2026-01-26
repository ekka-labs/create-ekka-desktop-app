/**
 * EKKA Client - Main Export
 * DO NOT EDIT - Managed by EKKA
 *
 * Usage:
 *   import { ekka } from './ekka';
 *
 *   await ekka.connect();
 *   await ekka.db.put('key', value);
 *   const data = await ekka.db.get('key');
 *
 * Everything runs in memory. No setup required.
 */

import { connect, disconnect, isConnected } from './client';
import { db, queue } from './api';
import type { Job } from './api';

export const ekka = {
  /**
   * Connect to the local demo environment.
   * Must be called before any db/queue operations.
   */
  connect,

  /**
   * Disconnect from the demo environment.
   */
  disconnect,

  /**
   * Check if connected.
   */
  isConnected,

  /**
   * Key-value database operations.
   */
  db,

  /**
   * Job queue operations.
   */
  queue,
};

// Re-export types
export type { Job };

// Re-export errors
export { EkkaError, EkkaNotConnectedError, EkkaConnectionError, EkkaApiError } from './errors';
