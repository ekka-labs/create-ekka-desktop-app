/**
 * Idempotency Key Utilities
 * Generate unique keys for idempotent operations.
 */

/**
 * Generate a unique idempotency key.
 * Format: timestamp-random (e.g., "1706284800000-a1b2c3d4e5f6")
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 14);
  return `${timestamp}-${random}`;
}
