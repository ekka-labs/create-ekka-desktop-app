/**
 * Status Badge Component
 * Visual status indicator with color coding.
 */

import { type CSSProperties, type ReactElement } from 'react';

interface StatusBadgeProps {
  status: string;
  darkMode?: boolean;
}

type StatusColor = 'green' | 'amber' | 'red' | 'blue' | 'gray';

function getStatusColor(status: string): StatusColor {
  const normalized = status.toLowerCase();

  // Success states
  if (['success', 'completed', 'active', 'connected', 'online'].includes(normalized)) {
    return 'green';
  }

  // Warning states
  if (['warning', 'pending', 'processing', 'running'].includes(normalized)) {
    return 'amber';
  }

  // Error states
  if (['error', 'failed', 'disconnected', 'offline'].includes(normalized)) {
    return 'red';
  }

  // Info states
  if (['info', 'new', 'created'].includes(normalized)) {
    return 'blue';
  }

  // Default
  return 'gray';
}

export function StatusBadge({ status, darkMode = false }: StatusBadgeProps): ReactElement {
  const color = getStatusColor(status);

  const colorMap: Record<StatusColor, { bg: string; text: string }> = {
    green: {
      bg: darkMode ? '#14532d' : '#dcfce7',
      text: darkMode ? '#4ade80' : '#166534',
    },
    amber: {
      bg: darkMode ? '#422006' : '#fef3c7',
      text: darkMode ? '#fbbf24' : '#92400e',
    },
    red: {
      bg: darkMode ? '#3c1618' : '#fef2f2',
      text: darkMode ? '#fca5a5' : '#991b1b',
    },
    blue: {
      bg: darkMode ? '#1e3a5f' : '#e0f2fe',
      text: darkMode ? '#60a5fa' : '#0369a1',
    },
    gray: {
      bg: darkMode ? '#374151' : '#f3f4f6',
      text: darkMode ? '#9ca3af' : '#6b7280',
    },
  };

  const { bg, text } = colorMap[color];

  const styles: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    background: bg,
    color: text,
    textTransform: 'capitalize',
  };

  return <span style={styles}>{status}</span>;
}
