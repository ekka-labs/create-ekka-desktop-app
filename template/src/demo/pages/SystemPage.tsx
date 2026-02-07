/**
 * System Page
 *
 * Shows cryptographic identity, security status, and system configuration.
 * Designed to inspire confidence in the security architecture.
 */

import { useState, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { ekka, advanced, type HomeStatus, type RuntimeInfo, type RunnerStatus } from '../../ekka';

interface SystemPageProps {
  darkMode: boolean;
}

interface SystemInfo {
  runtime: RuntimeInfo | null;
  homeStatus: HomeStatus | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    tenantId: string;
    tenantName: string | null;
  } | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 0) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return '—';
  }
}

function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
}

export function SystemPage({ darkMode }: SystemPageProps): ReactElement {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<SystemInfo>({
    runtime: null,
    homeStatus: null,
    user: null,
  });
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus | null>(null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    void loadSystemInfo();
    void loadRunnerStatus();

    // Poll runner status every 2 seconds
    pollingRef.current = window.setInterval(() => {
      void loadRunnerStatus();
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  async function loadRunnerStatus(): Promise<void> {
    try {
      const status = await advanced.runner.status();
      setRunnerStatus(status);
    } catch {
      // Silently ignore - runner status is optional
    }
  }

  async function loadSystemInfo(): Promise<void> {
    try {
      const [runtime, homeStatus] = await Promise.all([
        advanced.runtime.info().catch(() => null),
        advanced.home.status().catch(() => null),
      ]);

      const currentUser = ekka.auth.user();
      const user = currentUser
        ? {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name,
            tenantId: currentUser.company?.id || 'default',
            tenantName: currentUser.company?.name || null,
          }
        : null;

      setInfo({ runtime, homeStatus, user });
    } finally {
      setLoading(false);
    }
  }

  const colors = {
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#6e6e73',
    textDim: darkMode ? '#636366' : '#aeaeb2',
    bg: darkMode ? '#2c2c2e' : '#fafafa',
    bgAlt: darkMode ? '#1c1c1e' : '#ffffff',
    border: darkMode ? '#3a3a3c' : '#e5e5e5',
    accent: darkMode ? '#0a84ff' : '#007aff',
    green: darkMode ? '#30d158' : '#34c759',
    orange: darkMode ? '#ff9f0a' : '#ff9500',
    red: darkMode ? '#ff453a' : '#ff3b30',
    purple: darkMode ? '#bf5af2' : '#af52de',
    mono: darkMode ? '#98989d' : '#6e6e73',
  };

  const styles: Record<string, CSSProperties> = {
    container: {
      width: '100%',
    },
    header: {
      marginBottom: '32px',
    },
    title: {
      fontSize: '28px',
      fontWeight: 700,
      color: colors.text,
      marginBottom: '8px',
      letterSpacing: '-0.02em',
    },
    subtitle: {
      fontSize: '14px',
      color: colors.textMuted,
      lineHeight: 1.5,
    },
    section: {
      marginBottom: '24px',
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '12px',
    },
    sectionTitle: {
      fontSize: '11px',
      fontWeight: 600,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    sectionLine: {
      flex: 1,
      height: '1px',
      background: colors.border,
    },
    card: {
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      overflow: 'hidden',
    },
    row: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '14px 16px',
      borderBottom: `1px solid ${colors.border}`,
      gap: '16px',
    },
    rowLast: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '14px 16px',
      gap: '16px',
    },
    label: {
      fontSize: '13px',
      color: colors.textMuted,
      fontWeight: 500,
      minWidth: '120px',
      flexShrink: 0,
    },
    value: {
      fontSize: '13px',
      color: colors.text,
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      wordBreak: 'break-all' as const,
      textAlign: 'right' as const,
    },
    valueMuted: {
      fontSize: '13px',
      color: colors.textDim,
      fontStyle: 'italic' as const,
      textAlign: 'right' as const,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 600,
    },
    badgeGreen: {
      background: darkMode ? 'rgba(48, 209, 88, 0.15)' : 'rgba(52, 199, 89, 0.12)',
      color: colors.green,
    },
    badgeOrange: {
      background: darkMode ? 'rgba(255, 159, 10, 0.15)' : 'rgba(255, 149, 0, 0.12)',
      color: colors.orange,
    },
    badgePurple: {
      background: darkMode ? 'rgba(191, 90, 242, 0.15)' : 'rgba(175, 82, 222, 0.12)',
      color: colors.purple,
    },
    badgeBlue: {
      background: darkMode ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.12)',
      color: colors.accent,
    },
    dot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: 'currentColor',
    },
    securityBanner: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      background: darkMode ? 'rgba(48, 209, 88, 0.08)' : 'rgba(52, 199, 89, 0.06)',
      borderRadius: '12px',
      marginBottom: '24px',
    },
    securityIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '10px',
      background: darkMode ? 'rgba(48, 209, 88, 0.15)' : 'rgba(52, 199, 89, 0.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.green,
    },
    securityText: {
      flex: 1,
    },
    securityTitle: {
      fontSize: '14px',
      fontWeight: 600,
      color: colors.text,
      marginBottom: '2px',
    },
    securitySubtitle: {
      fontSize: '12px',
      color: colors.textMuted,
    },
    loadingContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: colors.textMuted,
      fontSize: '14px',
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>System</h1>
        </header>
        <div style={styles.loadingContainer}>Loading system information...</div>
      </div>
    );
  }

  const isSecure = info.homeStatus?.state === 'HOME_GRANTED';
  const mode = advanced.internal.mode();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>System</h1>
        <p style={styles.subtitle}>
          Cryptographic identity, security status, and runtime configuration
        </p>
      </header>

      {/* Security Status Banner */}
      <div
        style={{
          ...styles.securityBanner,
          background: isSecure
            ? darkMode
              ? 'rgba(48, 209, 88, 0.08)'
              : 'rgba(52, 199, 89, 0.06)'
            : darkMode
              ? 'rgba(255, 159, 10, 0.08)'
              : 'rgba(255, 149, 0, 0.06)',
        }}
      >
        <div
          style={{
            ...styles.securityIcon,
            background: isSecure
              ? darkMode
                ? 'rgba(48, 209, 88, 0.15)'
                : 'rgba(52, 199, 89, 0.12)'
              : darkMode
                ? 'rgba(255, 159, 10, 0.15)'
                : 'rgba(255, 149, 0, 0.12)',
            color: isSecure ? colors.green : colors.orange,
          }}
        >
          <ShieldIcon />
        </div>
        <div style={styles.securityText}>
          <div style={styles.securityTitle}>
            {isSecure ? 'Secure Session Active' : 'Setup Required'}
          </div>
          <div style={styles.securitySubtitle}>
            {isSecure
              ? 'Ed25519 signed grants verified · Home directory protected'
              : 'Home grant required to complete security initialization'}
          </div>
        </div>
        <span
          style={{
            ...styles.badge,
            ...(isSecure ? styles.badgeGreen : styles.badgeOrange),
          }}
        >
          <span style={styles.dot} />
          {isSecure ? 'Protected' : 'Pending'}
        </span>
      </div>

      {/* Identity Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Identity</span>
          <div style={styles.sectionLine} />
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.label}>User ID</span>
            <span style={styles.value}>{info.user?.id || '—'}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Email</span>
            <span style={styles.value}>{info.user?.email || '—'}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Tenant ID</span>
            <span style={styles.value}>{info.user?.tenantId || '—'}</span>
          </div>
          <div style={styles.rowLast}>
            <span style={styles.label}>Organization</span>
            <span style={info.user?.tenantName ? styles.value : styles.valueMuted}>
              {info.user?.tenantName || 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Runtime Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Runtime</span>
          <div style={styles.sectionLine} />
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.label}>Environment</span>
            <span style={{ ...styles.badge, ...styles.badgeBlue }}>
              {info.runtime?.runtime === 'ekka-bridge' ? 'EKKA Desktop' : 'Web Browser'}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Backend Mode</span>
            <span style={{ ...styles.badge, ...styles.badgePurple }}>
              {mode === 'engine' ? 'Engine' : 'Demo'}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Engine Present</span>
            <span style={styles.value}>{info.runtime?.engine_present ? 'Yes' : 'No'}</span>
          </div>
          <div style={styles.rowLast}>
            <span style={styles.label}>Client Version</span>
            <span style={styles.value}>0.2.0</span>
          </div>
        </div>
      </div>

      {/* Home Directory Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Home Directory</span>
          <div style={styles.sectionLine} />
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.label}>Path</span>
            <span style={styles.value}>{info.homeStatus?.homePath || '—'}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>State</span>
            <span
              style={{
                ...styles.badge,
                ...(info.homeStatus?.state === 'HOME_GRANTED'
                  ? styles.badgeGreen
                  : styles.badgeOrange),
              }}
            >
              {formatHomeState(info.homeStatus?.state)}
            </span>
          </div>
          <div style={styles.rowLast}>
            <span style={styles.label}>Grant Present</span>
            <span style={styles.value}>{info.homeStatus?.grantPresent ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Security</span>
          <div style={styles.sectionLine} />
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.label}>Signing Algorithm</span>
            <span style={styles.value}>Ed25519</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Canonicalization</span>
            <span style={styles.value}>JCS (RFC 8785)</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Grant Schema</span>
            <span style={styles.value}>ekka.grant.v1</span>
          </div>
          <div style={styles.rowLast}>
            <span style={styles.label}>Storage Layout</span>
            <span style={styles.value}>v1</span>
          </div>
        </div>
      </div>

      {/* Runner Status Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Runner Status</span>
          <div style={styles.sectionLine} />
          <span style={{ fontSize: '10px', color: colors.textDim, marginLeft: '8px' }}>
            Auto-refresh: 2s
          </span>
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.label}>Runner Enabled</span>
            <span style={styles.value}>{runnerStatus?.enabled ? 'Yes' : 'No'}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Runner State</span>
            <span
              style={{
                ...styles.badge,
                ...(runnerStatus?.state === 'running'
                  ? styles.badgeGreen
                  : runnerStatus?.state === 'error'
                    ? { background: darkMode ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 59, 48, 0.12)', color: colors.red }
                    : styles.badgeOrange),
              }}
            >
              <span style={styles.dot} />
              {runnerStatus?.state === 'running' ? 'Running' : runnerStatus?.state === 'error' ? 'Error' : 'Stopped'}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Runner ID</span>
            <span style={styles.value}>{shortId(runnerStatus?.runnerId ?? null)}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Engine URL</span>
            <span style={runnerStatus?.engineUrl ? styles.value : styles.valueMuted}>
              {runnerStatus?.engineUrl || 'Not configured'}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Last Poll</span>
            <span style={runnerStatus?.lastPollAt ? styles.value : styles.valueMuted}>
              {timeAgo(runnerStatus?.lastPollAt ?? null)}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Last Claim</span>
            <span style={runnerStatus?.lastClaimAt ? styles.value : styles.valueMuted}>
              {runnerStatus?.lastClaimAt
                ? `${timeAgo(runnerStatus.lastClaimAt)} · ${shortId(runnerStatus.lastTaskId ?? null)}`
                : '—'}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Last Complete</span>
            <span style={runnerStatus?.lastCompleteAt ? styles.value : styles.valueMuted}>
              {runnerStatus?.lastCompleteAt
                ? `${timeAgo(runnerStatus.lastCompleteAt)} · ${shortId(runnerStatus.lastTaskId ?? null)}`
                : '—'}
            </span>
          </div>
          <div style={styles.rowLast}>
            <span style={styles.label}>Last Error</span>
            <span style={runnerStatus?.lastError ? { ...styles.value, color: colors.red } : styles.valueMuted}>
              {runnerStatus?.lastError || '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatHomeState(state: string | undefined): string {
  switch (state) {
    case 'HOME_GRANTED':
      return 'Granted';
    case 'AUTHENTICATED_NO_HOME_GRANT':
      return 'Awaiting Grant';
    case 'BOOTSTRAP_PRE_LOGIN':
      return 'Pre-Login';
    default:
      return 'Unknown';
  }
}

function ShieldIcon(): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
