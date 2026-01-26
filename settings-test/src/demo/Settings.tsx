/**
 * EKKA Settings & Runtime Diagnostics
 * SAFE TO DELETE - This is part of the demo
 *
 * Shows runtime environment information for debugging and verification.
 */

import { useState, useEffect } from 'react';

// Type definitions for Tauri API
declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: <T>(cmd: string) => Promise<T>;
      };
    };
  }
}

interface RuntimeInfo {
  runtime: string;
  engine_present: boolean;
  engine_path: string | null;
  app_version: string;
}

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuntimeInfo();
  }, []);

  async function fetchRuntimeInfo() {
    setLoading(true);

    // Check if running in Tauri
    if (window.__TAURI__) {
      try {
        const info = await window.__TAURI__.core.invoke<RuntimeInfo>('get_runtime_info');
        setRuntimeInfo(info);
      } catch (err) {
        console.error('Failed to get runtime info:', err);
        // Fallback to web mode if invoke fails
        setRuntimeInfo({
          runtime: 'web',
          engine_present: false,
          engine_path: null,
          app_version: 'unknown',
        });
      }
    } else {
      // Web mode - no Tauri available
      setRuntimeInfo({
        runtime: 'web',
        engine_present: false,
        engine_path: null,
        app_version: 'unknown',
      });
    }

    setLoading(false);
  }

  const styles = {
    container: {
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '680px',
      margin: '0 auto',
      color: '#1a1a1a',
    },
    header: {
      marginBottom: '2rem',
      paddingBottom: '1.5rem',
      borderBottom: '1px solid #e5e5e5',
    },
    backButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0',
      background: 'transparent',
      border: 'none',
      color: '#666',
      fontSize: '0.875rem',
      cursor: 'pointer',
      marginBottom: '1rem',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#111',
      margin: 0,
    },
    section: {
      marginBottom: '2rem',
    },
    sectionTitle: {
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#666',
      marginBottom: '1rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
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
      alignItems: 'flex-start',
      padding: '0.75rem 0',
      borderBottom: '1px solid #eee',
    },
    rowLast: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '0.75rem 0',
    },
    label: {
      fontSize: '0.875rem',
      color: '#555',
      fontWeight: 500,
    },
    value: {
      fontSize: '0.875rem',
      color: '#111',
      textAlign: 'right' as const,
      maxWidth: '60%',
      wordBreak: 'break-all' as const,
    },
    badge: {
      display: 'inline-block',
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 600,
    },
    badgeTauri: {
      background: '#e0f2fe',
      color: '#0369a1',
    },
    badgeWeb: {
      background: '#fef3c7',
      color: '#92400e',
    },
    badgePresent: {
      background: '#dcfce7',
      color: '#166534',
    },
    badgeNotPresent: {
      background: '#f3f4f6',
      color: '#6b7280',
    },
    loading: {
      padding: '2rem',
      textAlign: 'center' as const,
      color: '#666',
      fontSize: '0.875rem',
    },
    pathValue: {
      fontSize: '0.75rem',
      color: '#666',
      fontFamily: 'monospace',
      marginTop: '0.25rem',
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading runtime information...</div>
      </div>
    );
  }

  const isTauri = runtimeInfo?.runtime === 'tauri';
  const enginePresent = runtimeInfo?.engine_present ?? false;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          &larr; Back to Demo
        </button>
        <h1 style={styles.title}>Settings</h1>
      </header>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Runtime Diagnostics</h2>
        <div style={styles.card}>
          {/* Runtime */}
          <div style={styles.row}>
            <span style={styles.label}>Runtime</span>
            <span style={styles.value}>
              <span
                style={{
                  ...styles.badge,
                  ...(isTauri ? styles.badgeTauri : styles.badgeWeb),
                }}
              >
                {isTauri ? 'Desktop (Tauri)' : 'Web (Browser)'}
              </span>
            </span>
          </div>

          {/* Engine Status */}
          <div style={styles.row}>
            <span style={styles.label}>Engine</span>
            <span style={styles.value}>
              <span
                style={{
                  ...styles.badge,
                  ...(enginePresent ? styles.badgePresent : styles.badgeNotPresent),
                }}
              >
                {enginePresent ? 'Present' : 'Not present'}
              </span>
            </span>
          </div>

          {/* Engine Path (only if present) */}
          {enginePresent && runtimeInfo?.engine_path && (
            <div style={styles.row}>
              <span style={styles.label}>Engine Path</span>
              <div style={styles.value}>
                <div style={styles.pathValue}>{runtimeInfo.engine_path}</div>
              </div>
            </div>
          )}

          {/* App Version */}
          <div style={styles.rowLast}>
            <span style={styles.label}>App Version</span>
            <span style={styles.value}>
              <code>{runtimeInfo?.app_version ?? 'unknown'}</code>
            </span>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>About</h2>
        <div style={styles.card}>
          <div style={styles.rowLast}>
            <span style={{ ...styles.label, flex: 1 }}>
              This screen displays runtime diagnostics for the EKKA Desktop application.
              Use this information to verify the execution environment and engine availability.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
