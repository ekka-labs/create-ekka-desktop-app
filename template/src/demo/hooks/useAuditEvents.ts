/**
 * useAuditEvents Hook
 * React hook for subscribing to audit events.
 */

import { useState, useEffect } from 'react';
import {
  getAuditEvents,
  subscribeToAuditEvents,
  type AuditEvent,
} from '../../ekka/audit';

/**
 * Hook to subscribe to and retrieve audit events.
 * Re-renders when events change.
 */
export function useAuditEvents(): AuditEvent[] {
  const [events, setEvents] = useState<AuditEvent[]>(getAuditEvents);

  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = subscribeToAuditEvents(() => {
      setEvents(getAuditEvents());
    });

    return unsubscribe;
  }, []);

  return events;
}
