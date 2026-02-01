/**
 * Audit Event Store
 * In-memory store for audit events with subscription support.
 */

import type { AuditEvent } from './types';

// In-memory event store
const events: AuditEvent[] = [];
const listeners: Set<() => void> = new Set();

let eventCounter = 0;

/**
 * Generate a unique event ID.
 */
function generateEventId(): string {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

/**
 * Notify all subscribers of a change.
 */
function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Add a new audit event to the store.
 */
export function addAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp'>
): void {
  const fullEvent: AuditEvent = {
    ...event,
    id: generateEventId(),
    timestamp: new Date(),
  };
  events.unshift(fullEvent); // Add to beginning (newest first)
  notifyListeners();
}

/**
 * Get all audit events (newest first).
 */
export function getAuditEvents(): AuditEvent[] {
  return [...events];
}

/**
 * Clear all audit events.
 */
export function clearAuditEvents(): void {
  events.length = 0;
  notifyListeners();
}

/**
 * Subscribe to audit event changes.
 * Returns an unsubscribe function.
 */
export function subscribeToAuditEvents(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
