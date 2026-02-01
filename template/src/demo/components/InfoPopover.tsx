/**
 * Info Popover Component
 * Shows an info icon that displays detailed info on click.
 * Uses position: fixed to avoid being clipped by parent overflow.
 */

import { useState, useRef, useEffect, type CSSProperties, type ReactElement, type ReactNode } from 'react';

interface InfoItem {
  label: string;
  value: string | ReactNode;
  mono?: boolean;
}

interface InfoPopoverProps {
  items: InfoItem[];
  darkMode?: boolean;
}

export function InfoPopover({ items, darkMode = false }: InfoPopoverProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const colors = {
    icon: darkMode ? '#98989d' : '#86868b',
    iconHover: darkMode ? '#0a84ff' : '#007aff',
    bg: darkMode ? '#2c2c2e' : '#ffffff',
    border: darkMode ? '#3a3a3c' : '#e5e5e5',
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#86868b',
  };

  const styles: Record<string, CSSProperties> = {
    container: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      padding: 0,
      background: 'transparent',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      color: isOpen ? colors.iconHover : colors.icon,
      transition: 'color 0.15s ease',
    },
    popover: {
      position: 'fixed',
      top: position.top,
      right: position.right,
      padding: '12px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      boxShadow: darkMode
        ? '0 4px 16px rgba(0, 0, 0, 0.4)'
        : '0 4px 16px rgba(0, 0, 0, 0.12)',
      zIndex: 9999,
      minWidth: '260px',
      maxWidth: '360px',
      maxHeight: '400px',
      overflowY: 'auto',
    },
    row: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '6px 0',
      borderBottom: `1px solid ${colors.border}`,
    },
    rowLast: {
      borderBottom: 'none',
    },
    label: {
      fontSize: '10px',
      fontWeight: 600,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },
    value: {
      fontSize: '12px',
      color: colors.text,
      wordBreak: 'break-all',
    },
    valueMono: {
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
    },
  };

  // Update position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  // Close on click outside or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => setIsOpen(false);

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  return (
    <div style={styles.container}>
      <button
        ref={buttonRef}
        style={styles.button}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="View details"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 7v4M8 5.5v.01"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div style={styles.popover} onClick={(e) => e.stopPropagation()}>
          {items.map((item, idx) => (
            <div
              key={item.label}
              style={{
                ...styles.row,
                ...(idx === items.length - 1 ? styles.rowLast : {}),
              }}
            >
              <span style={styles.label}>{item.label}</span>
              <span style={{ ...styles.value, ...(item.mono ? styles.valueMono : {}) }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
