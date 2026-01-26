/**
 * EKKA Demo Settings
 * SAFE TO DELETE - This is part of the demo
 *
 * Shows runtime diagnostics for the demo environment.
 */

import { useState, useEffect } from 'react';

interface RuntimeInfo {
  runtime: string;
  engine_present: boolean;
  engine_path: string | null;
  engine_error: string | null;
}

export function Settings() {
  const [info, setInfo] = useState<RuntimeInfo>({
    runtime: 'web',
    engine_present: false,
    engine_path: null,
    engine_error: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function detect() {
      try {
        // Dynamic import to avoid bundling issues when running in browser
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<RuntimeInfo>('get_runtime_info');
        setInfo(result);
      } catch {
        // Not running in Tauri or command failed
        setInfo({ runtime: 'web', engine_present: false, engine_path: null, engine_error: null });
      }
      setLoading(false);
    }
    detect();
  }, []);

  const styles = {
    section: {
      marginBottom: '2.5rem',
    },
    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: 600,
      marginBottom: '0.5rem',
      color: '#111',
    },
    sectionContext: {
      fontSize: '0.9rem',
      lineHeight: 1.5,
      color: '#555',
      marginBottom: '1.25rem',
    },
    card: {
      padding: '1.25rem',
      background: '#fafafa',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
    },
    row: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.625rem 0',
      borderBottom: '1px solid #eee',
    },
    rowLast: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.625rem 0',
    },
    label: {
      fontSize: '0.875rem',
      color: '#555',
    },
    value: {
      fontSize: '0.875rem',
      color: '#111',
      fontWeight: 500,
    },
    badge: {
      display: 'inline-block',
      padding: '0.25rem 0.625rem',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 600,
    },
    badgeBlue: {
      background: '#e0f2fe',
      color: '#0369a1',
    },
    badgeAmber: {
      background: '#fef3c7',
      color: '#92400e',
    },
    badgeGreen: {
      background: '#dcfce7',
      color: '#166534',
    },
    badgeGray: {
      background: '#f3f4f6',
      color: '#6b7280',
    },
    pathText: {
      fontSize: '0.75rem',
      color: '#666',
      fontFamily: 'monospace',
      wordBreak: 'break-all' as const,
      marginTop: '0.25rem',
    },
    errorText: {
      fontSize: '0.75rem',
      color: '#dc2626',
      fontFamily: 'monospace',
      marginTop: '0.25rem',
    },
  };

  if (loading) {
    return (
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Runtime Diagnostics</h2>
        <div style={styles.card}>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>Loading...</p>
        </div>
      </section>
    );
  }

  const isDesktop = info.runtime === 'tauri';

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Runtime Diagnostics</h2>
      <p style={styles.sectionContext}>
        Information about how this demo is currently running.
      </p>
      <div style={styles.card}>
        <div style={styles.row}>
          <span style={styles.label}>Runtime</span>
          <span
            style={{
              ...styles.badge,
              ...(isDesktop ? styles.badgeBlue : styles.badgeAmber),
            }}
          >
            {isDesktop ? 'Desktop (Tauri)' : 'Web (Browser)'}
          </span>
        </div>

        <div style={styles.rowLast}>
          <span style={styles.label}>Engine</span>
          <span
            style={{
              ...styles.badge,
              ...(info.engine_present ? styles.badgeGreen : styles.badgeGray),
            }}
          >
            {info.engine_present ? 'Running' : 'Not present'}
          </span>
        </div>

      </div>
    </section>
  );
}
