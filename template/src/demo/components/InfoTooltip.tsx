/**
 * Info Tooltip Component
 * Shows an info icon that displays tooltip text on hover.
 */

import { useState, type CSSProperties, type ReactElement } from 'react';

interface InfoTooltipProps {
  text: string;
  darkMode?: boolean;
}

export function InfoTooltip({ text, darkMode = false }: InfoTooltipProps): ReactElement {
  const [isVisible, setIsVisible] = useState(false);

  const colors = {
    icon: darkMode ? '#98989d' : '#86868b',
    iconHover: darkMode ? '#ffffff' : '#1d1d1f',
    tooltipBg: darkMode ? '#3a3a3c' : '#1d1d1f',
    tooltipText: '#ffffff',
  };

  const styles: Record<string, CSSProperties> = {
    container: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
    },
    icon: {
      width: '14px',
      height: '14px',
      cursor: 'help',
      color: isVisible ? colors.iconHover : colors.icon,
      transition: 'color 0.15s ease',
    },
    tooltip: {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px',
      padding: '8px 12px',
      background: colors.tooltipBg,
      color: colors.tooltipText,
      fontSize: '12px',
      lineHeight: 1.4,
      borderRadius: '6px',
      whiteSpace: 'nowrap',
      maxWidth: '280px',
      zIndex: 1000,
      opacity: isVisible ? 1 : 0,
      visibility: isVisible ? 'visible' : 'hidden',
      transition: 'opacity 0.15s ease, visibility 0.15s ease',
      pointerEvents: 'none',
    },
  };

  return (
    <span
      style={styles.container}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <svg style={styles.icon} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 7v4M8 5.5v.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span style={styles.tooltip}>{text}</span>
    </span>
  );
}
