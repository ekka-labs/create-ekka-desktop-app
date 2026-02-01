/**
 * Audit Log Page
 * Displays audit events with expandable technical details.
 */

import { type CSSProperties, type ReactElement } from 'react';
import { clearAuditEvents, type AuditEvent } from '../../ekka/audit';
import { formatLocalTime, formatRelativeTime } from '../../ekka/utils';
import { useAuditEvents } from '../hooks/useAuditEvents';
import { EmptyState } from '../components/EmptyState';
import { LearnMore } from '../components/LearnMore';

interface AuditLogPageProps {
  darkMode: boolean;
}

export function AuditLogPage({ darkMode }: AuditLogPageProps): ReactElement {
  const events = useAuditEvents();

  const colors = {
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#6e6e73',
    bg: darkMode ? '#2c2c2e' : '#fafafa',
    border: darkMode ? '#3a3a3c' : '#e5e5e5',
    cardBg: darkMode ? '#2c2c2e' : '#ffffff',
    codeBg: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    buttonBg: darkMode ? '#3a3a3c' : '#f3f4f6',
    buttonHover: darkMode ? '#48484a' : '#e5e7eb',
    buttonText: darkMode ? '#ffffff' : '#1d1d1f',
  };

  const styles: Record<string, CSSProperties> = {
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '32px',
    },
    headerText: {},
    title: {
      fontSize: '28px',
      fontWeight: 700,
      color: colors.text,
      marginBottom: '8px',
      letterSpacing: '-0.02em',
    },
    description: {
      fontSize: '13px',
      lineHeight: 1.5,
      color: colors.textMuted,
    },
    clearButton: {
      padding: '8px 14px',
      fontSize: '13px',
      fontWeight: 500,
      color: colors.buttonText,
      background: colors.buttonBg,
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    },
    card: {
      background: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      overflow: 'hidden',
    },
    eventList: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
    },
    eventItem: {
      padding: '14px 16px',
      borderBottom: `1px solid ${colors.border}`,
    },
    eventItemLast: {
      padding: '14px 16px',
    },
    eventHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '4px',
    },
    eventType: {
      fontSize: '12px',
      fontWeight: 600,
      color: colors.text,
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      background: colors.codeBg,
      padding: '2px 8px',
      borderRadius: '4px',
    },
    eventTime: {
      fontSize: '12px',
      color: colors.textMuted,
    },
    eventDescription: {
      fontSize: '13px',
      color: colors.text,
      marginBottom: '4px',
      lineHeight: 1.4,
    },
    eventExplanation: {
      fontSize: '12px',
      color: colors.textMuted,
      fontStyle: 'italic',
      marginBottom: '8px',
    },
    technicalSection: {
      marginTop: '10px',
    },
    technicalContent: {
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      fontSize: '11px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
  };

  const handleClear = (): void => {
    clearAuditEvents();
  };

  const renderEmptyIcon = (): ReactElement => (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect
        x="8"
        y="6"
        width="32"
        height="36"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="14"
        y1="14"
        x2="34"
        y2="14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="22"
        x2="28"
        y2="22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="30"
        x2="32"
        y2="30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  const renderEvent = (event: AuditEvent, isLast: boolean): ReactElement => (
    <li key={event.id} style={isLast ? styles.eventItemLast : styles.eventItem}>
      <div style={styles.eventHeader}>
        <span style={styles.eventType}>{event.type}</span>
        <span style={styles.eventTime} title={formatLocalTime(event.timestamp)}>
          {formatRelativeTime(event.timestamp)}
        </span>
      </div>
      <p style={styles.eventDescription}>{event.description}</p>
      {event.explanation && (
        <p style={styles.eventExplanation}>{event.explanation}</p>
      )}
      {event.technical && Object.keys(event.technical).length > 0 && (
        <div style={styles.technicalSection}>
          <LearnMore title="Technical Details" darkMode={darkMode}>
            <pre style={styles.technicalContent}>
              {JSON.stringify(event.technical, null, 2)}
            </pre>
          </LearnMore>
        </div>
      )}
    </li>
  );

  return (
    <div>
      <header style={styles.header}>
        <div style={styles.headerText}>
          <h1 style={styles.title}>Audit Log</h1>
          <p style={styles.description}>
            Track system events and operations for debugging and compliance.
          </p>
        </div>
        {events.length > 0 && (
          <button
            style={styles.clearButton}
            onClick={handleClear}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.buttonHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.buttonBg;
            }}
          >
            Clear
          </button>
        )}
      </header>

      <div style={styles.card}>
        {events.length === 0 ? (
          <EmptyState
            icon={renderEmptyIcon()}
            message="No audit events yet"
            hint="Events will appear here as you interact with the system."
            darkMode={darkMode}
          />
        ) : (
          <ul style={styles.eventList}>
            {events.map((event, index) =>
              renderEvent(event, index === events.length - 1)
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
