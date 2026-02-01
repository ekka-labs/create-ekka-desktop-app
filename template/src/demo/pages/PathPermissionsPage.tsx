/**
 * Path Permissions Page
 *
 * Demo tab showing how EKKA manages filesystem access using engine-signed grants.
 * NO FILE I/O - only permission management demonstration.
 */

import { useState, useEffect, useCallback, type CSSProperties, type ReactElement } from 'react';
import { ekka, advanced, type PathInfo, type PathType, type PathAccess, type PathGrantResult } from '../../ekka';
import { InfoPopover } from '../components/InfoPopover';

interface PathPermissionsPageProps {
  darkMode: boolean;
}

interface PermissionCheck {
  allowed: boolean;
  reason: string;
  pathType: PathType | null;
  access: PathAccess | null;
  grantedBy: string | null;
}

export function PathPermissionsPage({ darkMode }: PathPermissionsPageProps): ReactElement {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<PermissionCheck | null>(null);
  const [grantResult, setGrantResult] = useState<PathGrantResult | null>(null);
  const [allPaths, setAllPaths] = useState<PathInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedAccess, setRequestedAccess] = useState<PathAccess>('READ_WRITE');

  const colors = {
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#6e6e73',
    textDim: darkMode ? '#636366' : '#aeaeb2',
    bg: darkMode ? '#2c2c2e' : '#fafafa',
    bgAlt: darkMode ? '#1c1c1e' : '#ffffff',
    bgInput: darkMode ? '#3a3a3c' : '#ffffff',
    border: darkMode ? '#3a3a3c' : '#e5e5e5',
    accent: darkMode ? '#0a84ff' : '#007aff',
    green: darkMode ? '#30d158' : '#34c759',
    orange: darkMode ? '#ff9f0a' : '#ff9500',
    red: darkMode ? '#ff453a' : '#ff3b30',
    purple: darkMode ? '#bf5af2' : '#af52de',
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
      lineHeight: 1.6,
      maxWidth: '600px',
    },
    section: {
      marginBottom: '28px',
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
      padding: '20px',
    },
    pathSelector: {
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      flexWrap: 'wrap' as const,
    },
    input: {
      flex: '1 1 300px',
      minWidth: '200px',
      padding: '10px 14px',
      fontSize: '13px',
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      color: colors.text,
      outline: 'none',
    },
    button: {
      padding: '10px 20px',
      fontSize: '13px',
      fontWeight: 600,
      color: '#ffffff',
      background: colors.accent,
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'opacity 0.15s ease',
      whiteSpace: 'nowrap' as const,
    },
    buttonSecondary: {
      padding: '10px 20px',
      fontSize: '13px',
      fontWeight: 600,
      color: colors.accent,
      background: darkMode ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'opacity 0.15s ease',
      whiteSpace: 'nowrap' as const,
    },
    buttonDanger: {
      padding: '10px 20px',
      fontSize: '13px',
      fontWeight: 600,
      color: colors.red,
      background: darkMode ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 59, 48, 0.1)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'opacity 0.15s ease',
      whiteSpace: 'nowrap' as const,
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    selectedPath: {
      marginTop: '16px',
      padding: '14px 16px',
      background: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: '8px',
    },
    selectedPathLabel: {
      fontSize: '11px',
      fontWeight: 600,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      marginBottom: '6px',
    },
    selectedPathValue: {
      fontSize: '13px',
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      color: colors.text,
      wordBreak: 'break-all' as const,
    },
    statusCard: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '20px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
    },
    statusIcon: {
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    statusContent: {
      flex: 1,
    },
    statusTitle: {
      fontSize: '16px',
      fontWeight: 600,
      color: colors.text,
      marginBottom: '4px',
    },
    statusReason: {
      fontSize: '13px',
      color: colors.textMuted,
    },
    grantPanel: {
      marginTop: '20px',
      padding: '20px',
      background: darkMode ? 'rgba(48, 209, 88, 0.08)' : 'rgba(52, 199, 89, 0.06)',
      borderRadius: '12px',
      border: `1px solid ${darkMode ? 'rgba(48, 209, 88, 0.2)' : 'rgba(52, 199, 89, 0.15)'}`,
    },
    grantTitle: {
      fontSize: '15px',
      fontWeight: 600,
      color: colors.green,
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    grantDetails: {
      display: 'grid',
      gap: '8px',
    },
    grantRow: {
      display: 'flex',
      gap: '12px',
      fontSize: '13px',
    },
    grantLabel: {
      color: colors.textMuted,
      minWidth: '100px',
    },
    grantValue: {
      color: colors.text,
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      wordBreak: 'break-all' as const,
    },
    table: {
      width: '100%',
      minWidth: '600px',
      borderCollapse: 'collapse' as const,
    },
    tableHeader: {
      textAlign: 'left' as const,
      padding: '12px 16px',
      fontSize: '11px',
      fontWeight: 600,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      borderBottom: `1px solid ${colors.border}`,
    },
    tableCell: {
      padding: '14px 16px',
      fontSize: '13px',
      color: colors.text,
      borderBottom: `1px solid ${colors.border}`,
    },
    tableCellMono: {
      padding: '14px 16px',
      fontSize: '12px',
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      color: colors.text,
      borderBottom: `1px solid ${colors.border}`,
      maxWidth: '300px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 600,
    },
    badgeGreen: {
      background: darkMode ? 'rgba(48, 209, 88, 0.15)' : 'rgba(52, 199, 89, 0.12)',
      color: colors.green,
    },
    badgeBlue: {
      background: darkMode ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.12)',
      color: colors.accent,
    },
    badgeOrange: {
      background: darkMode ? 'rgba(255, 159, 10, 0.15)' : 'rgba(255, 149, 0, 0.12)',
      color: colors.orange,
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '40px 20px',
      color: colors.textMuted,
      fontSize: '14px',
    },
    error: {
      marginBottom: '20px',
      padding: '12px 14px',
      background: darkMode ? '#3c1618' : '#fef2f2',
      border: `1px solid ${darkMode ? '#7f1d1d' : '#fecaca'}`,
      borderRadius: '8px',
      fontSize: '13px',
      color: darkMode ? '#fca5a5' : '#991b1b',
    },
    actions: {
      display: 'flex',
      gap: '12px',
      marginTop: '20px',
      flexWrap: 'wrap' as const,
      alignItems: 'center',
    },
    accessSelector: {
      display: 'flex',
      gap: '8px',
      padding: '16px',
      marginTop: '16px',
      background: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: '8px',
    },
    accessOption: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 16px',
      background: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
      color: colors.text,
      transition: 'all 0.15s ease',
    },
    accessOptionSelected: {
      background: colors.accent,
      borderColor: colors.accent,
      color: '#ffffff',
    },
    tableDangerButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      padding: 0,
      background: 'transparent',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      color: colors.red,
      opacity: 0.7,
      transition: 'opacity 0.15s ease, background 0.15s ease',
    },
  };

  // Load all paths on mount and after changes
  const loadPaths = useCallback(async () => {
    try {
      const paths = await ekka.paths.list();
      setAllPaths(paths);
    } catch {
      // Ignore errors when loading paths
    }
  }, []);

  useEffect(() => {
    void loadPaths();
  }, [loadPaths]);

  // Check permission status when path is selected
  const checkPermission = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setGrantResult(null);

    try {
      // Use advanced API to get detailed check result
      const result = await advanced.paths.check(path, 'read');
      setPermissionStatus(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check permission';
      setError(message);
      setPermissionStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle folder selection
  const handleBrowseFolder = async () => {
    setError(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setSelectedPath(selected);
        setPathInput(selected);
        await checkPermission(selected);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Dialog error: ${message}`);
    }
  };

  // Handle file selection
  const handleBrowseFile = async () => {
    setError(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: false, multiple: false });
      if (selected && typeof selected === 'string') {
        setSelectedPath(selected);
        setPathInput(selected);
        await checkPermission(selected);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Dialog error: ${message}`);
    }
  };

  // Handle manual path entry
  const handlePathSubmit = async () => {
    if (pathInput.trim()) {
      setSelectedPath(pathInput.trim());
      await checkPermission(pathInput.trim());
    }
  };

  // Request permission
  const handleRequestPermission = async () => {
    if (!selectedPath) return;

    setLoading(true);
    setError(null);

    try {
      const result = await ekka.paths.allow(selectedPath, {
        pathType: 'WORKSPACE',
        access: requestedAccess,
      });

      setGrantResult(result);

      if (result.success) {
        // Re-check permission status
        await checkPermission(selectedPath);
        // Refresh paths list
        await loadPaths();
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request permission';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Revoke permission for selected path (uses the granting path, not selected path)
  const handleRevokePermission = async () => {
    const pathToRevoke = permissionStatus?.grantedBy || selectedPath;
    if (!pathToRevoke) return;
    await handleRevokeByPath(pathToRevoke);
  };

  // Revoke permission by path
  const handleRevokeByPath = async (path: string) => {
    setLoading(true);
    setError(null);
    setGrantResult(null);

    try {
      await ekka.paths.remove(path);
      // Re-check permission status if we have a selected path
      if (selectedPath) {
        await checkPermission(selectedPath);
      }
      // Refresh paths list
      await loadPaths();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke permission';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatPathType = (type: PathType): string => {
    return type.replace(/_/g, ' ');
  };

  const formatAccess = (access: PathAccess): string => {
    return access === 'READ_WRITE' ? 'Read/Write' : 'Read Only';
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Path Permissions</h1>
        <p style={styles.subtitle}>
          EKKA requires explicit permission to access any path outside your home directory.
          When you approve, EKKA requests an engine-signed grant that unlocks access.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {/* Section A: Path Selector */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Select Path</span>
          <div style={styles.sectionLine} />
        </div>
        <div style={styles.card}>
          <div style={styles.pathSelector}>
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handlePathSubmit();
              }}
              placeholder="/path/to/directory"
              style={styles.input}
            />
            <button
              onClick={() => void handleBrowseFolder()}
              style={styles.buttonSecondary}
              disabled={loading}
              title="Select folder"
            >
              📁
            </button>
            <button
              onClick={() => void handleBrowseFile()}
              style={styles.buttonSecondary}
              disabled={loading}
              title="Select file"
            >
              📄
            </button>
            <button
              onClick={() => void handlePathSubmit()}
              style={{
                ...styles.button,
                ...(loading || !pathInput.trim() ? styles.buttonDisabled : {}),
              }}
              disabled={loading || !pathInput.trim()}
            >
              Check Path
            </button>
          </div>

        </div>
      </div>

      {/* Section B: Permission Status */}
      {selectedPath && permissionStatus && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Permission Status</span>
            <div style={styles.sectionLine} />
          </div>
          <div
            style={{
              ...styles.statusCard,
              background: permissionStatus.allowed
                ? darkMode
                  ? 'rgba(48, 209, 88, 0.08)'
                  : 'rgba(52, 199, 89, 0.06)'
                : darkMode
                  ? 'rgba(255, 69, 58, 0.08)'
                  : 'rgba(255, 59, 48, 0.06)',
              borderColor: permissionStatus.allowed
                ? darkMode
                  ? 'rgba(48, 209, 88, 0.2)'
                  : 'rgba(52, 199, 89, 0.15)'
                : darkMode
                  ? 'rgba(255, 69, 58, 0.2)'
                  : 'rgba(255, 59, 48, 0.15)',
            }}
          >
            <div
              style={{
                ...styles.statusIcon,
                background: permissionStatus.allowed
                  ? darkMode
                    ? 'rgba(48, 209, 88, 0.15)'
                    : 'rgba(52, 199, 89, 0.12)'
                  : darkMode
                    ? 'rgba(255, 69, 58, 0.15)'
                    : 'rgba(255, 59, 48, 0.12)',
                color: permissionStatus.allowed ? colors.green : colors.red,
              }}
            >
              {permissionStatus.allowed ? <CheckIcon /> : <DeniedIcon />}
            </div>
            <div style={styles.statusContent}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={styles.statusTitle}>
                  {permissionStatus.allowed ? 'Access Allowed' : 'Access Denied'}
                </div>
                {permissionStatus.allowed && (
                  <InfoPopover
                    darkMode={darkMode}
                    items={[
                      { label: 'Grant Path', value: permissionStatus.grantedBy || selectedPath || '-', mono: true },
                      { label: 'Selected Path', value: selectedPath || '-', mono: true },
                      { label: 'Type', value: permissionStatus.pathType ? formatPathType(permissionStatus.pathType) : '-' },
                      { label: 'Access', value: permissionStatus.access ? formatAccess(permissionStatus.access) : '-' },
                    ]}
                  />
                )}
              </div>
              {permissionStatus.allowed && permissionStatus.pathType && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ ...styles.badge, ...styles.badgeBlue }}>
                    {formatPathType(permissionStatus.pathType)}
                  </span>
                  {permissionStatus.access && (
                    <span style={{ ...styles.badge, ...styles.badgeGreen }}>
                      {formatAccess(permissionStatus.access)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section C: Access Selection & Grant */}
          {!permissionStatus.allowed && (
            <div style={styles.accessSelector}>
              <span style={{ fontSize: '13px', color: colors.textMuted, marginRight: '8px' }}>
                Access level:
              </span>
              <button
                onClick={() => setRequestedAccess('READ_ONLY')}
                style={{
                  ...styles.accessOption,
                  ...(requestedAccess === 'READ_ONLY' ? styles.accessOptionSelected : {}),
                }}
              >
                <ReadIcon />
                Read Only
              </button>
              <button
                onClick={() => setRequestedAccess('READ_WRITE')}
                style={{
                  ...styles.accessOption,
                  ...(requestedAccess === 'READ_WRITE' ? styles.accessOptionSelected : {}),
                }}
              >
                <WriteIcon />
                Read/Write
              </button>
            </div>
          )}

          {/* Section D: Grant/Revoke Actions */}
          <div style={styles.actions}>
            {!permissionStatus.allowed && (
              <button
                onClick={() => void handleRequestPermission()}
                style={{
                  ...styles.button,
                  ...(loading ? styles.buttonDisabled : {}),
                }}
                disabled={loading}
              >
                {loading ? 'Requesting...' : `Grant ${requestedAccess === 'READ_WRITE' ? 'Read/Write' : 'Read Only'} Access`}
              </button>
            )}
            {permissionStatus.allowed && (
              <button
                onClick={() => void handleRevokePermission()}
                style={{
                  ...styles.buttonDanger,
                  ...(loading ? styles.buttonDisabled : {}),
                }}
                disabled={loading}
              >
                {loading ? 'Revoking...' : 'Revoke Permission'}
              </button>
            )}
          </div>

          {/* Grant Success Panel */}
          {grantResult?.success && (
            <div style={styles.grantPanel}>
              <div style={styles.grantTitle}>
                <CheckIcon />
                Permission Granted
              </div>
              <div style={styles.grantDetails}>
                <div style={styles.grantRow}>
                  <span style={styles.grantLabel}>Path</span>
                  <span style={styles.grantValue}>{selectedPath}</span>
                </div>
                <div style={styles.grantRow}>
                  <span style={styles.grantLabel}>Type</span>
                  <span style={styles.grantValue}>WORKSPACE</span>
                </div>
                <div style={styles.grantRow}>
                  <span style={styles.grantLabel}>Access</span>
                  <span style={styles.grantValue}>{requestedAccess}</span>
                </div>
                {grantResult.grantId && (
                  <div style={styles.grantRow}>
                    <span style={styles.grantLabel}>Grant ID</span>
                    <span style={styles.grantValue}>{grantResult.grantId}</span>
                  </div>
                )}
                <div style={styles.grantRow}>
                  <span style={styles.grantLabel}>Signed by</span>
                  <span style={styles.grantValue}>EKKA Engine</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section E: Current Permissions Table */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Current Permissions</span>
          <div style={styles.sectionLine} />
        </div>
        <div style={{ ...styles.card, padding: 0, overflowX: 'auto' }}>
          {allPaths.length === 0 ? (
            <div style={styles.emptyState}>
              No path permissions granted yet.
              <br />
              Select a path above to request access.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Path Prefix</th>
                  <th style={styles.tableHeader}>Type</th>
                  <th style={styles.tableHeader}>Access</th>
                  <th style={styles.tableHeader}>Status</th>
                  <th style={{ ...styles.tableHeader, width: '80px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPaths.map((path) => (
                  <tr key={path.grantId}>
                    <td style={styles.tableCellMono} title={path.path}>
                      {path.path}
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{ ...styles.badge, ...styles.badgeBlue }}>
                        {formatPathType(path.pathType)}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{ ...styles.badge, ...styles.badgeGreen }}>
                        {formatAccess(path.access)}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(path.isValid ? styles.badgeGreen : styles.badgeOrange),
                        }}
                      >
                        {path.isValid ? 'Valid' : 'Expired'}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <InfoPopover
                          darkMode={darkMode}
                          items={[
                            { label: 'Grant ID', value: path.grantId, mono: true },
                            { label: 'Path', value: path.path, mono: true },
                            { label: 'Type', value: formatPathType(path.pathType) },
                            { label: 'Access', value: formatAccess(path.access) },
                            { label: 'Issuer', value: path.issuer },
                            { label: 'Issued At', value: formatDate(path.issuedAt) },
                            { label: 'Expires At', value: path.expiresAt ? formatDate(path.expiresAt) : 'Never' },
                            { label: 'User', value: path.subject },
                            { label: 'Tenant', value: path.tenantId },
                            { label: 'Purpose', value: path.purpose },
                          ]}
                        />
                        <button
                          onClick={() => void handleRevokeByPath(path.path)}
                          style={styles.tableDangerButton}
                          disabled={loading}
                          title="Revoke this permission"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function DeniedIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

function ReadIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3.5a4.5 4.5 0 0 0-4.041 2.5h-.709a5.5 5.5 0 0 1 9.5 0h-.709A4.5 4.5 0 0 0 8 3.5z" />
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
      <path d="M1.323 8.5l-.5-.866C1.89 6.482 4.2 4.5 8 4.5c3.8 0 6.11 1.982 7.177 3.134l-.5.866C13.69 7.475 11.541 5.5 8 5.5 4.459 5.5 2.31 7.475 1.323 8.5z" />
    </svg>
  );
}

function WriteIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
    </svg>
  );
}

function TrashIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
    </svg>
  );
}
