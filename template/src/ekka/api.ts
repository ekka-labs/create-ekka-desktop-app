/**
 * EKKA API - db and queue operations
 * DO NOT EDIT - Managed by EKKA
 *
 * Uses the in-memory demo backend.
 * No network calls. No setup required.
 */

import * as demoBackend from './demo-backend';
import { isConnected } from './client';
import { EkkaNotConnectedError } from './errors';

// =============================================================================
// HELPERS
// =============================================================================

function ensureConnected(): void {
  if (!isConnected()) {
    throw new EkkaNotConnectedError();
  }
}

// =============================================================================
// DB API
// =============================================================================

export const db = {
  /**
   * Get a value from the key-value store.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    ensureConnected();
    // Simulate async for API consistency
    await Promise.resolve();
    return demoBackend.dbGet<T>(key);
  },

  /**
   * Put a value into the key-value store.
   */
  async put<T = unknown>(key: string, value: T): Promise<void> {
    ensureConnected();
    await Promise.resolve();
    demoBackend.dbPut(key, value);
  },

  /**
   * Delete a value from the key-value store.
   */
  async delete(key: string): Promise<void> {
    ensureConnected();
    await Promise.resolve();
    demoBackend.dbDelete(key);
  },
};

// =============================================================================
// QUEUE API
// =============================================================================

export interface Job<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  created_at: string;
}

export const queue = {
  /**
   * Enqueue a job into the job queue.
   */
  async enqueue<T = unknown>(kind: string, payload: T): Promise<string> {
    ensureConnected();
    await Promise.resolve();
    return demoBackend.queueEnqueue(kind, payload);
  },

  /**
   * Claim the next available job from the queue.
   * Returns null if no jobs are available.
   */
  async claim<T = unknown>(): Promise<Job<T> | null> {
    ensureConnected();
    await Promise.resolve();
    return demoBackend.queueClaim<T>();
  },

  /**
   * Acknowledge a job as completed.
   */
  async ack(job: Job): Promise<void> {
    ensureConnected();
    await Promise.resolve();
    demoBackend.queueAck(job.id);
  },

  /**
   * Reject a job (return it to the queue).
   */
  async nack(job: Job): Promise<void> {
    ensureConnected();
    await Promise.resolve();
    demoBackend.queueNack(job.id);
  },
};
