/**
 * Home Setup Page
 *
 * Shown after login when HOME grant is not yet present.
 * User must click "Next" to request HOME grant from engine.
 */

import { useState, type ReactElement } from 'react';
import { advanced, type HomeStatus } from '../../ekka';

interface HomeSetupPageProps {
  homeStatus: HomeStatus;
  onGranted: () => void;
  darkMode: boolean;
}

export function HomeSetupPage({ homeStatus, onGranted, darkMode }: HomeSetupPageProps): ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const colors = {
    bg: darkMode ? '#1c1c1e' : '#ffffff',
    cardBg: darkMode ? '#2c2c2e' : '#f5f5f7',
    border: darkMode ? '#3a3a3c' : '#e5e5e5',
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#86868b',
    codeBg: darkMode ? '#1c1c1e' : '#f0f0f0',
    buttonBg: '#007aff',
    buttonHover: '#0066d6',
    errorBg: darkMode ? '#3c1618' : '#fef2f2',
    errorBorder: darkMode ? '#7f1d1d' : '#fecaca',
    errorText: darkMode ? '#fca5a5' : '#991b1b',
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: colors.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
    },
    card: {
      width: '100%',
      maxWidth: '480px',
      padding: '32px',
      background: colors.cardBg,
      borderRadius: '12px',
      border: `1px solid ${colors.border}`,
    },
    title: {
      fontSize: '20px',
      fontWeight: 600,
      color: colors.text,
      textAlign: 'center',
      marginBottom: '8px',
    },
    subtitle: {
      fontSize: '13px',
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: '24px',
    },
    section: {
      marginBottom: '20px',
    },
    label: {
      fontSize: '12px',
      fontWeight: 500,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '6px',
    },
    codePath: {
      padding: '10px 12px',
      fontSize: '13px',
      fontFamily: 'SF Mono, Monaco, monospace',
      background: colors.codeBg,
      borderRadius: '6px',
      color: colors.text,
      wordBreak: 'break-all',
    },
    description: {
      fontSize: '13px',
      color: colors.textMuted,
      lineHeight: 1.5,
      marginBottom: '24px',
    },
    button: {
      width: '100%',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: 500,
      color: '#ffffff',
      background: colors.buttonBg,
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    },
    buttonDisabled: {
      background: colors.textMuted,
      cursor: 'not-allowed',
    },
    error: {
      padding: '10px 12px',
      fontSize: '13px',
      color: colors.errorText,
      background: colors.errorBg,
      border: `1px solid ${colors.errorBorder}`,
      borderRadius: '8px',
      marginBottom: '16px',
    },
  };

  async function handleRequestGrant(): Promise<void> {
    setError(null);
    setLoading(true);

    try {
      await advanced.home.grant();

      // Re-check status
      const status = await advanced.home.status();
      if (status.state === 'HOME_GRANTED') {
        onGranted();
      } else {
        setError(status.reason || 'Grant request completed but HOME not granted');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request HOME grant';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>Home Folder Setup</div>
        <div style={styles.subtitle}>EKKA needs permission to use your home folder</div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.section}>
          <div style={styles.label}>Home Path</div>
          <div style={styles.codePath}>{homeStatus.homePath || '(resolving...)'}</div>
        </div>

        <div style={styles.description}>
          EKKA stores encrypted data, configuration, and temporary files in this folder.
          Click "Continue" to authorize EKKA to use this location.
          This requires an internet connection to verify with the EKKA engine.
        </div>

        <button
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
          disabled={loading}
          onClick={handleRequestGrant}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = colors.buttonHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = colors.buttonBg;
            }
          }}
        >
          {loading ? 'Requesting...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
