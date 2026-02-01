/**
 * Time Formatting Utilities
 * Human-readable time formatting for the EKKA client.
 */

/**
 * Format a date as relative time (e.g., "2 minutes ago", "in 5 hours").
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const isPast = diffMs < 0;

  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let value: number;
  let unit: string;

  if (seconds < 60) {
    value = seconds;
    unit = 'second';
  } else if (minutes < 60) {
    value = minutes;
    unit = 'minute';
  } else if (hours < 24) {
    value = hours;
    unit = 'hour';
  } else {
    value = days;
    unit = 'day';
  }

  const plural = value !== 1 ? 's' : '';
  if (isPast) {
    return value === 0 ? 'just now' : `${value} ${unit}${plural} ago`;
  }
  return `in ${value} ${unit}${plural}`;
}

/**
 * Format a date as local time string (e.g., "3:45:30 PM").
 */
export function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format expiry information from an ISO date string.
 * Returns null if the input is invalid.
 */
export function formatExpiryInfo(
  expiresAtIso: string
): { text: string; isExpired: boolean } | null {
  try {
    const expiresAt = new Date(expiresAtIso);
    if (isNaN(expiresAt.getTime())) {
      return null;
    }

    const now = new Date();
    const isExpired = expiresAt.getTime() < now.getTime();
    const text = formatRelativeTime(expiresAt);

    return { text, isExpired };
  } catch {
    return null;
  }
}
