/**
 * Audit Event Types
 * Type definitions for the audit logging system.
 */

/**
 * Represents an audit event in the system.
 */
export interface AuditEvent {
  /** Unique identifier for the event */
  id: string;
  /** When the event occurred */
  timestamp: Date;
  /** Event type (e.g., 'db.put', 'auth.login') */
  type: string;
  /** Human-readable description */
  description: string;
  /** Optional explanation for non-technical users */
  explanation?: string;
  /** Optional technical details for debugging */
  technical?: Record<string, unknown>;
}
