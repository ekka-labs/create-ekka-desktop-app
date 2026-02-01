/**
 * Empty State Component
 * Placeholder UI for empty lists or sections.
 */

import { type CSSProperties, type ReactElement, type ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  hint?: string;
  darkMode?: boolean;
}

export function EmptyState({
  icon,
  message,
  hint,
  darkMode = false,
}: EmptyStateProps): ReactElement {
  const colors = {
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#6e6e73',
    iconColor: darkMode ? '#48484a' : '#d2d2d7',
  };

  const styles: Record<string, CSSProperties> = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
    },
    iconWrapper: {
      marginBottom: '16px',
      color: colors.iconColor,
    },
    message: {
      fontSize: '14px',
      fontWeight: 500,
      color: colors.text,
      marginBottom: hint ? '8px' : '0',
    },
    hint: {
      fontSize: '13px',
      color: colors.textMuted,
      maxWidth: '280px',
      lineHeight: 1.5,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.iconWrapper}>{icon}</div>
      <p style={styles.message}>{message}</p>
      {hint && <p style={styles.hint}>{hint}</p>}
    </div>
  );
}
