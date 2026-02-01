/**
 * Learn More Component
 * Expandable section for additional information.
 */

import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

interface LearnMoreProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  darkMode?: boolean;
}

export function LearnMore({
  title,
  children,
  defaultExpanded = false,
  darkMode = false,
}: LearnMoreProps): ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const colors = {
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#6e6e73',
    border: darkMode ? '#3a3a3c' : '#e5e5e5',
    bg: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    hover: darkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
  };

  const styles: Record<string, CSSProperties> = {
    container: {
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      background: colors.bg,
      border: 'none',
      borderRadius: 0,
      width: '100%',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    },
    title: {
      fontSize: '13px',
      fontWeight: 500,
      color: colors.text,
      margin: 0,
    },
    icon: {
      width: '14px',
      height: '14px',
      color: colors.textMuted,
      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
    },
    content: {
      padding: '14px',
      fontSize: '13px',
      lineHeight: 1.6,
      color: colors.textMuted,
      borderTop: `1px solid ${colors.border}`,
      display: expanded ? 'block' : 'none',
    },
  };

  return (
    <div style={styles.container}>
      <button
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colors.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = colors.bg;
        }}
      >
        <span style={styles.title}>{title}</span>
        <svg style={styles.icon} viewBox="0 0 16 16" fill="none">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div style={styles.content}>{children}</div>
    </div>
  );
}
