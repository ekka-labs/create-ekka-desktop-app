/**
 * Banner Component
 * Informational banner for warnings, info, and errors.
 */

import { type CSSProperties, type ReactElement } from 'react';

type BannerType = 'warning' | 'info' | 'error';

interface BannerProps {
  type: BannerType;
  message: string;
  darkMode?: boolean;
}

export function Banner({ type, message, darkMode = false }: BannerProps): ReactElement {
  const colorMap: Record<BannerType, { bg: string; border: string; text: string; icon: string }> = {
    warning: {
      bg: darkMode ? '#422006' : '#fffbeb',
      border: darkMode ? '#854d0e' : '#fcd34d',
      text: darkMode ? '#fcd34d' : '#92400e',
      icon: darkMode ? '#fbbf24' : '#f59e0b',
    },
    info: {
      bg: darkMode ? '#1e3a5f' : '#eff6ff',
      border: darkMode ? '#1d4ed8' : '#93c5fd',
      text: darkMode ? '#93c5fd' : '#1e40af',
      icon: darkMode ? '#60a5fa' : '#3b82f6',
    },
    error: {
      bg: darkMode ? '#3c1618' : '#fef2f2',
      border: darkMode ? '#7f1d1d' : '#fecaca',
      text: darkMode ? '#fca5a5' : '#991b1b',
      icon: darkMode ? '#f87171' : '#ef4444',
    },
  };

  const colors = colorMap[type];

  const styles: Record<string, CSSProperties> = {
    banner: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '12px 14px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      fontSize: '13px',
      lineHeight: 1.5,
      color: colors.text,
    },
    icon: {
      width: '16px',
      height: '16px',
      flexShrink: 0,
      marginTop: '1px',
      color: colors.icon,
    },
    message: {
      flex: 1,
      margin: 0,
    },
  };

  const iconPaths: Record<BannerType, string> = {
    warning:
      'M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
    info: 'M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z',
    error:
      'M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z',
  };

  return (
    <div style={styles.banner}>
      <svg style={styles.icon} viewBox="0 0 16 16" fill="currentColor">
        <path d={iconPaths[type]} />
      </svg>
      <p style={styles.message}>{message}</p>
    </div>
  );
}
