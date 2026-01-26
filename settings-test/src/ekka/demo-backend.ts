/**
 * EKKA In-Memory Demo Backend
 * DO NOT EDIT - Managed by EKKA
 *
 * This provides a fully functional in-memory implementation of the EKKA API.
 * No network calls. No persistence. Everything runs in the browser.
 * Perfect for learning and prototyping.
 */

// =============================================================================
// IN-MEMORY STORAGE
// =============================================================================

/** Key-value store */
const dbStore: Map<string, unknown> = new Map();

/** Job queue */
interface QueuedJob {
  id: string;
  kind: string;
  payload: unknown;
  created_at: string;
  claimed: boolean;
}

const jobQueue: QueuedJob[] = [];

/** Simple incrementing ID for jobs */
let nextJobId = 1;

// =============================================================================
// SESSION API
// =============================================================================

let _connected = false;

export function sessionOpen(): void {
  _connected = true;
}

export function sessionClose(): void {
  _connected = false;
}

export function isConnected(): boolean {
  return _connected;
}

// =============================================================================
// DB API
// =============================================================================

export function dbGet<T = unknown>(key: string): T | null {
  const value = dbStore.get(key);
  return value !== undefined ? (value as T) : null;
}

export function dbPut<T = unknown>(key: string, value: T): void {
  dbStore.set(key, value);
}

export function dbDelete(key: string): void {
  dbStore.delete(key);
}

// =============================================================================
// QUEUE API
// =============================================================================

export function queueEnqueue<T = unknown>(kind: string, payload: T): string {
  const id = `job-${nextJobId++}`;
  jobQueue.push({
    id,
    kind,
    payload,
    created_at: new Date().toISOString(),
    claimed: false,
  });
  return id;
}

export interface Job<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  created_at: string;
}

export function queueClaim<T = unknown>(): Job<T> | null {
  const job = jobQueue.find((j) => !j.claimed);
  if (!job) return null;
  job.claimed = true;
  return {
    id: job.id,
    kind: job.kind,
    payload: job.payload as T,
    created_at: job.created_at,
  };
}

export function queueAck(jobId: string): void {
  const index = jobQueue.findIndex((j) => j.id === jobId);
  if (index !== -1) {
    jobQueue.splice(index, 1);
  }
}

export function queueNack(jobId: string): void {
  const job = jobQueue.find((j) => j.id === jobId);
  if (job) {
    job.claimed = false;
  }
}

// =============================================================================
// DEBUG / RESET
// =============================================================================

export function resetAll(): void {
  dbStore.clear();
  jobQueue.length = 0;
  nextJobId = 1;
  _connected = false;
}
