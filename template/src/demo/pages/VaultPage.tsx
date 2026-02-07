/**
 * Vault Page
 *
 * Admin UI for managing secrets, bundles, folders, and audit log.
 * Four tabs: Secrets, Bundles, Folders, Audit
 *
 * IMPORTANT: Secret values are NEVER displayed. Only metadata is shown.
 */

import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type ReactElement } from 'react';
import { ekka, type SecretMeta, type SecretType, type BundleMeta, type FileEntry, type AuditEvent } from '../../ekka';
import { EmptyState, InfoTooltip } from '../components';
import { Banner } from '../components/Banner';

// =============================================================================
// TYPES
// =============================================================================

type VaultTab = 'secrets' | 'bundles' | 'files' | 'audit';

interface VaultPageProps {
  darkMode: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

const formatSecretType = (type: SecretType): string => {
  const map: Record<SecretType, string> = { PASSWORD: 'Password', API_KEY: 'API Key', TOKEN: 'Token', CERTIFICATE: 'Certificate', SSH_KEY: 'SSH Key', GENERIC_TEXT: 'Generic' };
  return map[type] || type;
};

const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// =============================================================================
// ICONS
// =============================================================================

const SecretIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="12" y="20" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M18 20V14a6 6 0 1 1 12 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="24" cy="29" r="2" fill="currentColor" />
    <path d="M24 31v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BundleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="8" y="12" width="32" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="8" y="24" width="32" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="8" y="36" width="32" height="6" rx="2" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const FilesIconLarge = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M12 8h16l8 8v24a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" stroke="currentColor" strokeWidth="2" />
    <path d="M28 8v8h8" stroke="currentColor" strokeWidth="2" />
    <line x1="14" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="2" />
    <line x1="14" y1="30" x2="26" y2="30" stroke="currentColor" strokeWidth="2" />
    <line x1="14" y1="36" x2="24" y2="36" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.764.382 2.236 1l.472.707c.188.282.51.543 1.028.543h4.5A1.5 1.5 0 0 1 15 5.75v6.75A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9zm1.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V5.75a.5.5 0 0 0-.5-.5H9a2.016 2.016 0 0 1-1.528-.793l-.472-.707C6.764 3.393 6.366 3 5.264 3H2.5z" />
  </svg>
);

const AuditIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="10" y="8" width="28" height="32" rx="2" stroke="currentColor" strokeWidth="2" />
    <line x1="16" y1="16" x2="32" y2="16" stroke="currentColor" strokeWidth="2" />
    <line x1="16" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="2" />
    <line x1="16" y1="32" x2="30" y2="32" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
  </svg>
);

const RotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
  </svg>
);

const ViewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
  </svg>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VaultPage({ darkMode }: VaultPageProps): ReactElement {
  const [activeTab, setActiveTab] = useState<VaultTab>('secrets');

  // =============================================================================
  // COLORS & STYLES (memoized)
  // =============================================================================

  const colors = useMemo(() => ({
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
  }), [darkMode]);

  const styles = useMemo((): Record<string, CSSProperties> => ({
    container: { width: '100%' },
    header: { marginBottom: '24px' },
    title: { fontSize: '28px', fontWeight: 700, color: colors.text, marginBottom: '8px', letterSpacing: '-0.02em' },
    subtitle: { fontSize: '14px', color: colors.textMuted, lineHeight: 1.6, maxWidth: '600px' },
    tabNav: { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '0' },
    tabButton: { padding: '10px 16px', fontSize: '13px', fontWeight: 500, color: colors.textMuted, background: 'transparent', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' },
    tabButtonActive: { color: colors.accent, borderBottomColor: colors.accent },
    card: { background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '20px' },
    toolbar: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' as const, alignItems: 'center' },
    searchInput: { flex: '1 1 200px', minWidth: '150px', maxWidth: '300px', padding: '8px 12px', fontSize: '13px', background: colors.bgInput, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, outline: 'none' },
    select: { padding: '8px 12px', fontSize: '13px', background: colors.bgInput, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, outline: 'none', cursor: 'pointer' },
    button: { padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#ffffff', background: colors.accent, border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
    buttonSecondary: { padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: colors.accent, background: darkMode ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
    buttonDanger: { padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: colors.red, background: darkMode ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 59, 48, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
    buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    tableHeader: { textAlign: 'left' as const, padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: `1px solid ${colors.border}` },
    tableCell: { padding: '12px 16px', fontSize: '13px', color: colors.text, borderBottom: `1px solid ${colors.border}` },
    tableCellMono: { padding: '12px 16px', fontSize: '12px', fontFamily: 'SF Mono, Monaco, Consolas, monospace', color: colors.text, borderBottom: `1px solid ${colors.border}`, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    tableDangerButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', padding: 0, background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: colors.red, opacity: 0.7 },
    tableActionButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', padding: 0, background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: colors.accent, opacity: 0.7 },
    badge: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
    badgeBlue: { background: darkMode ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.12)', color: colors.accent },
    badgePurple: { background: darkMode ? 'rgba(191, 90, 242, 0.15)' : 'rgba(175, 82, 222, 0.12)', color: colors.purple },
    notImplementedCard: { background: darkMode ? 'rgba(255, 159, 10, 0.08)' : 'rgba(255, 149, 0, 0.06)', border: `1px solid ${darkMode ? 'rgba(255, 159, 10, 0.2)' : 'rgba(255, 149, 0, 0.15)'}`, borderRadius: '12px', padding: '24px', textAlign: 'center' as const },
    notImplementedTitle: { fontSize: '16px', fontWeight: 600, color: colors.orange, marginBottom: '8px' },
    notImplementedText: { fontSize: '13px', color: colors.textMuted, lineHeight: 1.5 },
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: darkMode ? '#2c2c2e' : '#ffffff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' },
    modalTitle: { fontSize: '18px', fontWeight: 600, color: colors.text, marginBottom: '20px' },
    inputGroup: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textMuted, marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
    input: { width: '100%', padding: '10px 12px', fontSize: '13px', background: colors.bgInput, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text, outline: 'none', boxSizing: 'border-box' as const },
    modalActions: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' },
    folderTree: { display: 'flex', gap: '20px' },
    folderTreeLeft: { flex: '1 1 300px', minWidth: '200px' },
    folderTreeRight: { flex: '1 1 300px', minWidth: '200px' },
    folderItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' },
    folderItemSelected: { background: darkMode ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)' },
    folderIcon: { color: colors.accent },
    folderName: { flex: 1, fontSize: '13px', color: colors.text },
    detailPanel: { background: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)', borderRadius: '8px', padding: '16px' },
    detailRow: { display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '13px' },
    detailLabel: { color: colors.textMuted, minWidth: '80px' },
    detailValue: { color: colors.text },
    bundleDrawer: { marginTop: '16px', background: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)', borderRadius: '12px', padding: '16px' },
    bundleDrawerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
    bundleDrawerTitle: { fontSize: '15px', fontWeight: 600, color: colors.text },
    pagination: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' },
    loadingOverlay: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: colors.textMuted, fontSize: '14px' },
  }), [colors, darkMode]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Vault <InfoTooltip text="Encrypted-at-rest secret storage, local to this node. Secrets never leave the device unencrypted. Organize with bundles and folders; every access is audited." darkMode={darkMode} /></h1>
        <p style={styles.subtitle}>Securely manage secrets, organize them into bundles and folders, and track all access.</p>
      </header>

      <div style={styles.tabNav}>
        {(['secrets', 'bundles', 'files', 'audit'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ ...styles.tabButton, ...(activeTab === tab ? styles.tabButtonActive : {}) }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'secrets' && <SecretsTab darkMode={darkMode} colors={colors} styles={styles} />}
      {activeTab === 'bundles' && <BundlesTab darkMode={darkMode} colors={colors} styles={styles} />}
      {activeTab === 'files' && <FilesTab darkMode={darkMode} colors={colors} styles={styles} />}
      {activeTab === 'audit' && <AuditTab darkMode={darkMode} colors={colors} styles={styles} />}
    </div>
  );
}

// =============================================================================
// SECRETS TAB (separate component to isolate hook)
// =============================================================================

function SecretsTab({ darkMode, colors, styles }: { darkMode: boolean; colors: Record<string, string>; styles: Record<string, CSSProperties> }): ReactElement {
  const [secrets, setSecrets] = useState<SecretMeta[]>([]);
  const [bundles, setBundles] = useState<BundleMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState<SecretMeta | null>(null);
  const [newSecret, setNewSecret] = useState({ name: '', value: '', bundleId: '', secretType: 'GENERIC_TEXT' as SecretType, tags: '' });
  const [rotateValue, setRotateValue] = useState('');

  // Ref guards to prevent double-loads in StrictMode
  const didLoadSecretsRef = useRef(false);
  const didLoadBundlesRef = useRef(false);

  const loadSecrets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ekka.vault.secrets.list();
      setSecrets(result);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('not implemented') || err.message.includes('op_unknown'))) {
        setNotImplemented(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBundles = useCallback(async () => {
    if (didLoadBundlesRef.current) return;
    didLoadBundlesRef.current = true;
    try {
      const result = await ekka.vault.bundles.list();
      setBundles(result);
    } catch { /* ignore */ }
  }, []);

  // Load secrets only once on mount
  useEffect(() => {
    if (didLoadSecretsRef.current) return;
    didLoadSecretsRef.current = true;
    void loadSecrets();
  }, [loadSecrets]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await ekka.vault.secrets.create({ name: newSecret.name, value: newSecret.value, bundleId: newSecret.bundleId || undefined, secretType: newSecret.secretType, tags: newSecret.tags ? newSecret.tags.split(',').map(t => t.trim()) : undefined });
      setShowCreateModal(false);
      setNewSecret({ name: '', value: '', bundleId: '', secretType: 'GENERIC_TEXT', tags: '' });
      void loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async () => {
    if (!showRotateModal) return;
    setLoading(true);
    try {
      await ekka.vault.secrets.update(showRotateModal.id, { value: rotateValue });
      setShowRotateModal(null);
      setRotateValue('');
      void loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this secret?')) return;
    try {
      await ekka.vault.secrets.delete(id);
      void loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (notImplemented) return <div style={styles.notImplementedCard}><div style={styles.notImplementedTitle}>Backend Not Implemented</div><p style={styles.notImplementedText}>The secrets backend is not yet available.</p></div>;

  const filtered = search ? secrets.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) : secrets;

  return (
    <>
      {error && <div style={{ marginBottom: '16px' }}><Banner type="error" message={error} darkMode={darkMode} /></div>}
      <div style={styles.toolbar}>
        <input type="text" placeholder="Filter secrets..." value={search} onChange={e => setSearch(e.target.value)} style={styles.searchInput} />
        <button onClick={() => void loadSecrets()} style={styles.buttonSecondary} disabled={loading}>Refresh</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setShowCreateModal(true); void loadBundles(); }} style={styles.button}>Create Secret</button>
      </div>
      <div style={{ ...styles.card, padding: 0, overflowX: 'auto' }}>
        {loading && secrets.length === 0 ? <div style={styles.loadingOverlay}>Loading...</div> : filtered.length === 0 ? <EmptyState icon={<SecretIcon />} message="No secrets yet" hint="Create your first secret." darkMode={darkMode} /> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.tableHeader}>Name</th><th style={styles.tableHeader}>Type</th><th style={styles.tableHeader}>Tags</th><th style={styles.tableHeader}>Updated</th><th style={{ ...styles.tableHeader, width: '100px', textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td style={styles.tableCellMono}>{s.name}</td>
                  <td style={styles.tableCell}><span style={{ ...styles.badge, ...styles.badgeBlue }}>{formatSecretType(s.secretType)}</span></td>
                  <td style={styles.tableCell}>{s.tags.length > 0 ? s.tags.slice(0, 2).map(t => <span key={t} style={{ ...styles.badge, ...styles.badgePurple, marginRight: 4 }}>{t}</span>) : <span style={{ color: colors.textDim }}>-</span>}</td>
                  <td style={styles.tableCell}>{formatDate(s.updatedAt)}</td>
                  <td style={styles.tableCell}><div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}><button onClick={() => setShowRotateModal(s)} style={styles.tableActionButton} title="Rotate"><RotateIcon /></button><button onClick={() => void handleDelete(s.id)} style={styles.tableDangerButton} title="Delete"><TrashIcon /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create Secret</h2>
            <div style={styles.inputGroup}><label style={styles.label}>Name</label><input type="text" value={newSecret.name} onChange={e => setNewSecret({ ...newSecret, name: e.target.value })} style={styles.input} /></div>
            <div style={styles.inputGroup}><label style={styles.label}>Value</label><input type="password" value={newSecret.value} onChange={e => setNewSecret({ ...newSecret, value: e.target.value })} style={styles.input} /></div>
            <div style={styles.inputGroup}><label style={styles.label}>Type</label><select value={newSecret.secretType} onChange={e => setNewSecret({ ...newSecret, secretType: e.target.value as SecretType })} style={styles.select}><option value="GENERIC_TEXT">Generic</option><option value="PASSWORD">Password</option><option value="API_KEY">API Key</option><option value="TOKEN">Token</option></select></div>
            <div style={styles.inputGroup}><label style={styles.label}>Bundle</label><select value={newSecret.bundleId} onChange={e => setNewSecret({ ...newSecret, bundleId: e.target.value })} style={styles.select}><option value="">None</option>{bundles.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div style={styles.inputGroup}><label style={styles.label}>Tags</label><input type="text" value={newSecret.tags} onChange={e => setNewSecret({ ...newSecret, tags: e.target.value })} placeholder="tag1, tag2" style={styles.input} /></div>
            <div style={styles.modalActions}><button onClick={() => setShowCreateModal(false)} style={styles.buttonSecondary}>Cancel</button><button onClick={() => void handleCreate()} style={{ ...styles.button, ...(!newSecret.name || !newSecret.value ? styles.buttonDisabled : {}) }} disabled={!newSecret.name || !newSecret.value || loading}>{loading ? 'Creating...' : 'Create'}</button></div>
          </div>
        </div>
      )}
      {showRotateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowRotateModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Rotate Secret</h2>
            <p style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '20px' }}>Secret: <strong>{showRotateModal.name}</strong></p>
            <div style={styles.inputGroup}><label style={styles.label}>New Value</label><input type="password" value={rotateValue} onChange={e => setRotateValue(e.target.value)} style={styles.input} /></div>
            <div style={styles.modalActions}><button onClick={() => setShowRotateModal(null)} style={styles.buttonSecondary}>Cancel</button><button onClick={() => void handleRotate()} style={{ ...styles.button, ...(!rotateValue ? styles.buttonDisabled : {}) }} disabled={!rotateValue || loading}>{loading ? 'Rotating...' : 'Rotate'}</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// BUNDLES TAB
// =============================================================================

function BundlesTab({ darkMode, styles }: { darkMode: boolean; colors: Record<string, string>; styles: Record<string, CSSProperties> }): ReactElement {
  const [bundles, setBundles] = useState<BundleMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState<BundleMeta | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<BundleMeta | null>(null);
  const [bundleSecrets, setBundleSecrets] = useState<SecretMeta[]>([]);
  const [newName, setNewName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  // Ref guard to prevent double-loads in StrictMode
  const didLoadRef = useRef(false);

  const loadBundles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ekka.vault.bundles.list();
      setBundles(result);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('not implemented') || err.message.includes('op_unknown'))) {
        setNotImplemented(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load bundles only once on mount
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadBundles();
  }, [loadBundles]);

  const loadBundleSecrets = useCallback(async (bundle: BundleMeta) => {
    try {
      const secrets = await Promise.all(bundle.secretIds.map(id => ekka.vault.secrets.get(id)));
      setBundleSecrets(secrets);
    } catch { setBundleSecrets([]); }
  }, []);

  useEffect(() => { if (selectedBundle) void loadBundleSecrets(selectedBundle); }, [selectedBundle, loadBundleSecrets]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await ekka.vault.bundles.create({ name: newName });
      setShowCreateModal(false);
      setNewName('');
      void loadBundles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!showRenameModal) return;
    setLoading(true);
    try {
      await ekka.vault.bundles.rename(showRenameModal.id, renameValue);
      setShowRenameModal(null);
      setRenameValue('');
      void loadBundles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bundle?')) return;
    try {
      await ekka.vault.bundles.delete(id);
      if (selectedBundle?.id === id) setSelectedBundle(null);
      void loadBundles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleRemoveSecret = async (secretId: string) => {
    if (!selectedBundle) return;
    try {
      await ekka.vault.bundles.removeSecret(selectedBundle.id, secretId);
      void loadBundles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  if (notImplemented) return <div style={styles.notImplementedCard}><div style={styles.notImplementedTitle}>Backend Not Implemented</div><p style={styles.notImplementedText}>The bundles backend is not yet available.</p></div>;

  const filtered = search ? bundles.filter(b => b.name.toLowerCase().includes(search.toLowerCase())) : bundles;

  return (
    <>
      {error && <div style={{ marginBottom: '16px' }}><Banner type="error" message={error} darkMode={darkMode} /></div>}
      <div style={styles.toolbar}>
        <input type="text" placeholder="Filter bundles..." value={search} onChange={e => setSearch(e.target.value)} style={styles.searchInput} />
        <button onClick={() => void loadBundles()} style={styles.buttonSecondary} disabled={loading}>Refresh</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCreateModal(true)} style={styles.button}>Create Bundle</button>
      </div>
      <div style={{ ...styles.card, padding: 0, overflowX: 'auto' }}>
        {loading && bundles.length === 0 ? <div style={styles.loadingOverlay}>Loading...</div> : filtered.length === 0 ? <EmptyState icon={<BundleIcon />} message="No bundles yet" hint="Create your first bundle." darkMode={darkMode} /> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.tableHeader}>Name</th><th style={styles.tableHeader}>Secrets</th><th style={styles.tableHeader}>Updated</th><th style={{ ...styles.tableHeader, width: '120px', textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td style={styles.tableCellMono}>{b.name}</td>
                  <td style={styles.tableCell}><span style={{ ...styles.badge, ...styles.badgeBlue }}>{b.secretIds.length}</span></td>
                  <td style={styles.tableCell}>{formatDate(b.updatedAt)}</td>
                  <td style={styles.tableCell}><div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}><button onClick={() => { setSelectedBundle(b); setBundleSecrets([]); }} style={styles.tableActionButton} title="View"><ViewIcon /></button><button onClick={() => { setShowRenameModal(b); setRenameValue(b.name); }} style={styles.tableActionButton} title="Rename"><EditIcon /></button><button onClick={() => void handleDelete(b.id)} style={styles.tableDangerButton} title="Delete"><TrashIcon /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selectedBundle && (
        <div style={styles.bundleDrawer}>
          <div style={styles.bundleDrawerHeader}><div style={styles.bundleDrawerTitle}>Bundle: {selectedBundle.name}</div><button onClick={() => setSelectedBundle(null)} style={styles.buttonSecondary}>Close</button></div>
          {bundleSecrets.length === 0 ? <EmptyState icon={<SecretIcon />} message="No secrets in bundle" hint="Add secrets to this bundle." darkMode={darkMode} /> : (
            <table style={styles.table}>
              <thead><tr><th style={styles.tableHeader}>Name</th><th style={styles.tableHeader}>Type</th><th style={{ ...styles.tableHeader, width: '80px', textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>{bundleSecrets.map(s => <tr key={s.id}><td style={styles.tableCellMono}>{s.name}</td><td style={styles.tableCell}><span style={{ ...styles.badge, ...styles.badgeBlue }}>{formatSecretType(s.secretType)}</span></td><td style={styles.tableCell}><button onClick={() => void handleRemoveSecret(s.id)} style={styles.tableDangerButton} title="Remove"><TrashIcon /></button></td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create Bundle</h2>
            <div style={styles.inputGroup}><label style={styles.label}>Name</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} style={styles.input} /></div>
            <div style={styles.modalActions}><button onClick={() => setShowCreateModal(false)} style={styles.buttonSecondary}>Cancel</button><button onClick={() => void handleCreate()} style={{ ...styles.button, ...(!newName ? styles.buttonDisabled : {}) }} disabled={!newName || loading}>{loading ? 'Creating...' : 'Create'}</button></div>
          </div>
        </div>
      )}
      {showRenameModal && (
        <div style={styles.modalOverlay} onClick={() => setShowRenameModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Rename Bundle</h2>
            <div style={styles.inputGroup}><label style={styles.label}>New Name</label><input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} style={styles.input} /></div>
            <div style={styles.modalActions}><button onClick={() => setShowRenameModal(null)} style={styles.buttonSecondary}>Cancel</button><button onClick={() => void handleRename()} style={{ ...styles.button, ...(!renameValue ? styles.buttonDisabled : {}) }} disabled={!renameValue || loading}>{loading ? 'Renaming...' : 'Rename'}</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// FILES TAB
// =============================================================================

function FilesTab({ darkMode, colors, styles }: { darkMode: boolean; colors: Record<string, string>; styles: Record<string, CSSProperties> }): ReactElement {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [showCreateDirModal, setShowCreateDirModal] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  // Ref guard to prevent double-loads in StrictMode
  const didLoadRef = useRef(false);

  const loadFiles = useCallback(async (path: string = '/') => {
    setLoading(true);
    setError(null);
    try {
      const result = await ekka.vault.files.list(path);
      setFiles(result);
      setCurrentPath(path);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('not implemented') || err.message.includes('op_unknown'))) {
        setNotImplemented(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load files only once on mount
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadFiles('/');
  }, [loadFiles]);

  const handleNavigate = (path: string) => {
    setSelectedFile(null);
    void loadFiles(path);
  };

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return;
    setLoading(true);
    try {
      const path = currentPath === '/' ? `/${newDirName}` : `${currentPath}/${newDirName}`;
      await ekka.vault.files.mkdir(path);
      setShowCreateDirModal(false);
      setNewDirName('');
      void loadFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create directory');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (file: FileEntry) => {
    const msg = file.kind === 'DIR' ? 'Delete this directory and all its contents?' : 'Delete this file?';
    if (!confirm(msg)) return;
    try {
      await ekka.vault.files.delete(file.path, { recursive: file.kind === 'DIR' });
      if (selectedFile?.path === file.path) setSelectedFile(null);
      void loadFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const getParentPath = (path: string): string => {
    if (path === '/') return '/';
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.length === 0 ? '/' : '/' + parts.join('/');
  };

  if (notImplemented) return <div style={styles.notImplementedCard}><div style={styles.notImplementedTitle}>Backend Not Implemented</div><p style={styles.notImplementedText}>The files backend is not yet available.</p></div>;

  const dirs = files.filter(f => f.kind === 'DIR');
  const regularFiles = files.filter(f => f.kind === 'FILE');

  return (
    <>
      {error && <div style={{ marginBottom: '16px' }}><Banner type="error" message={error} darkMode={darkMode} /></div>}
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => handleNavigate(getParentPath(currentPath))} style={styles.buttonSecondary} disabled={currentPath === '/' || loading}>↑ Up</button>
          <span style={{ fontSize: '13px', fontFamily: 'SF Mono, Monaco, Consolas, monospace', color: colors.text }}>{currentPath}</span>
        </div>
        <button onClick={() => void loadFiles(currentPath)} style={styles.buttonSecondary} disabled={loading}>Refresh</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCreateDirModal(true)} style={styles.button}>New Directory</button>
      </div>
      <div style={styles.card}>
        {loading && files.length === 0 ? <div style={styles.loadingOverlay}>Loading...</div> : files.length === 0 ? <EmptyState icon={<FilesIconLarge />} message="Empty directory" hint="Create directories or upload files." darkMode={darkMode} /> : (
          <div style={styles.folderTree}>
            <div style={styles.folderTreeLeft}>
              {dirs.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingLeft: '12px' }}>Directories</div>
                  {dirs.map(d => (
                    <div key={d.path} onDoubleClick={() => handleNavigate(d.path)} onClick={() => setSelectedFile(d)} style={{ ...styles.folderItem, ...(selectedFile?.path === d.path ? styles.folderItemSelected : {}) }}>
                      <span style={styles.folderIcon}><FolderIcon /></span>
                      <span style={styles.folderName}>{d.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {regularFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingLeft: '12px' }}>Files</div>
                  {regularFiles.map(f => (
                    <div key={f.path} onClick={() => setSelectedFile(f)} style={{ ...styles.folderItem, ...(selectedFile?.path === f.path ? styles.folderItemSelected : {}) }}>
                      <span style={{ ...styles.folderIcon, color: colors.textMuted }}>📄</span>
                      <span style={styles.folderName}>{f.name}</span>
                      <span style={{ fontSize: '11px', color: colors.textDim }}>{formatFileSize(f.sizeBytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.folderTreeRight}>
              {selectedFile ? (
                <div style={styles.detailPanel}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: colors.text }}>{selectedFile.name}</div>
                    <button onClick={() => void handleDelete(selectedFile)} style={styles.buttonDanger}>Delete</button>
                  </div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Type</span><span style={styles.detailValue}>{selectedFile.kind === 'DIR' ? 'Directory' : 'File'}</span></div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Path</span><span style={{ ...styles.detailValue, fontFamily: 'SF Mono, Monaco, Consolas, monospace', fontSize: '12px' }}>{selectedFile.path}</span></div>
                  {selectedFile.sizeBytes !== undefined && <div style={styles.detailRow}><span style={styles.detailLabel}>Size</span><span style={styles.detailValue}>{formatFileSize(selectedFile.sizeBytes)}</span></div>}
                  {selectedFile.modifiedAt && <div style={styles.detailRow}><span style={styles.detailLabel}>Modified</span><span style={styles.detailValue}>{formatDateTime(selectedFile.modifiedAt)}</span></div>}
                  {selectedFile.kind === 'DIR' && <button onClick={() => handleNavigate(selectedFile.path)} style={{ ...styles.button, marginTop: '16px' }}>Open Directory</button>}
                </div>
              ) : <div style={styles.detailPanel}><p style={{ fontSize: '13px', color: colors.textMuted, textAlign: 'center' }}>Select a file or directory</p></div>}
            </div>
          </div>
        )}
      </div>
      {showCreateDirModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateDirModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create Directory</h2>
            <div style={styles.inputGroup}><label style={styles.label}>Name</label><input type="text" value={newDirName} onChange={e => setNewDirName(e.target.value)} style={styles.input} placeholder="my-directory" /></div>
            <div style={styles.modalActions}><button onClick={() => setShowCreateDirModal(false)} style={styles.buttonSecondary}>Cancel</button><button onClick={() => void handleCreateDir()} style={{ ...styles.button, ...(!newDirName.trim() ? styles.buttonDisabled : {}) }} disabled={!newDirName.trim() || loading}>{loading ? 'Creating...' : 'Create'}</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// AUDIT TAB
// =============================================================================

function AuditTab({ darkMode, colors, styles }: { darkMode: boolean; colors: Record<string, string>; styles: Record<string, CSSProperties> }): ReactElement {
  const [entries, setEntries] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Ref guard to prevent double-loads in StrictMode
  const didLoadRef = useRef(false);
  const lastFilterRef = useRef(actionFilter);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ekka.vault.audit.list({ limit: 50, action: actionFilter || undefined });
      setEntries(result.events);
      setHasMore(result.hasMore);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('not implemented') || err.message.includes('op_unknown'))) {
        setNotImplemented(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  // Load audit only once on mount, or when filter changes
  useEffect(() => {
    // Allow reload if filter changed
    if (didLoadRef.current && lastFilterRef.current === actionFilter) return;
    didLoadRef.current = true;
    lastFilterRef.current = actionFilter;
    void loadAudit();
  }, [loadAudit, actionFilter]);

  if (notImplemented) return <div style={styles.notImplementedCard}><div style={styles.notImplementedTitle}>Backend Not Implemented</div><p style={styles.notImplementedText}>The audit backend is not yet available.</p></div>;

  const filtered = search ? entries.filter(e => (e.secretName?.toLowerCase().includes(search.toLowerCase())) || e.action.toLowerCase().includes(search.toLowerCase()) || e.path?.toLowerCase().includes(search.toLowerCase())) : entries;

  return (
    <>
      {error && <div style={{ marginBottom: '16px' }}><Banner type="error" message={error} darkMode={darkMode} /></div>}
      <div style={styles.toolbar}>
        <input type="text" placeholder="Filter..." value={search} onChange={e => setSearch(e.target.value)} style={styles.searchInput} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={styles.select}>
          <option value="">All events</option>
          <optgroup label="Secrets">
            <option value="secret.created">Secret Created</option>
            <option value="secret.updated">Secret Updated</option>
            <option value="secret.deleted">Secret Deleted</option>
            <option value="secret.accessed">Secret Accessed</option>
          </optgroup>
          <optgroup label="Bundles">
            <option value="bundle.created">Bundle Created</option>
            <option value="bundle.updated">Bundle Updated</option>
            <option value="bundle.deleted">Bundle Deleted</option>
          </optgroup>
          <optgroup label="Files">
            <option value="file.written">File Written</option>
            <option value="file.read">File Read</option>
            <option value="file.deleted">File Deleted</option>
            <option value="file.mkdir">Directory Created</option>
          </optgroup>
        </select>
        <button onClick={() => void loadAudit()} style={styles.buttonSecondary} disabled={loading}>Refresh</button>
      </div>
      <div style={{ ...styles.card, padding: 0, overflowX: 'auto' }}>
        {loading && entries.length === 0 ? <div style={styles.loadingOverlay}>Loading...</div> : filtered.length === 0 ? <EmptyState icon={<AuditIcon />} message="No audit entries" hint="Events will appear as actions are performed." darkMode={darkMode} /> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.tableHeader}>Time</th><th style={styles.tableHeader}>Action</th><th style={styles.tableHeader}>Target</th><th style={styles.tableHeader}>Actor</th></tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.eventId}>
                  <td style={styles.tableCell}>{formatDateTime(e.timestamp)}</td>
                  <td style={styles.tableCell}><span style={{ ...styles.badge, ...styles.badgeBlue }}>{e.action.replace(/\./g, ' ')}</span></td>
                  <td style={styles.tableCell}>{e.secretName || e.path || e.secretId || <span style={{ color: colors.textDim }}>-</span>}</td>
                  <td style={styles.tableCellMono}>{e.actorId || <span style={{ color: colors.textDim }}>system</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {hasMore && <div style={styles.pagination}><button onClick={() => void loadAudit()} style={styles.buttonSecondary} disabled={loading}>Load More</button></div>}
    </>
  );
}
