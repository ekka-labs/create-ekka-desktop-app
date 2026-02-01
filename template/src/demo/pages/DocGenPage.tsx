/**
 * Documentation Generation Page
 *
 * Allows users to select a source folder and generate documentation
 * using the ekka-docgen-basic prompt via wf_prompt_run workflow.
 */

import { useState, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { createWorkflowRun, getWorkflowRun, type WorkflowRun, type DebugBundleInfo } from '../../ekka/api/engine';
import { getAccessToken } from '../../ekka/auth/storage';
import * as debugOps from '../../ekka/ops/debug';

interface DocGenPageProps {
  darkMode: boolean;
}

type GenerationStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';

// Hardcoded prompt configuration - NO prompt selection UI
const PROMPT_CONFIG = {
  provider: 'opik',
  prompt_slug: 'ekka-docgen-basic',
  prompt_version: '1',
} as const;

export function DocGenPage({ darkMode }: DocGenPageProps): ReactElement {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [pathCopySuccess, setPathCopySuccess] = useState(false);
  const pollingRef = useRef<number | null>(null);

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
      maxWidth: '900px',
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
    folderSelector: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
    },
    selectedFolderBox: {
      flex: 1,
      padding: '12px 16px',
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      fontSize: '13px',
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      color: colors.text,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    placeholderText: {
      color: colors.textMuted,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
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
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
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
    progressCard: {
      padding: '20px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
    },
    progressHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px',
    },
    progressSpinner: {
      width: '20px',
      height: '20px',
      border: `2px solid ${colors.border}`,
      borderTopColor: colors.accent,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
    progressTitle: {
      fontSize: '15px',
      fontWeight: 600,
      color: colors.text,
    },
    progressSteps: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap' as const,
    },
    progressStep: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 500,
    },
    stepActive: {
      background: darkMode ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      color: colors.accent,
    },
    stepComplete: {
      background: darkMode ? 'rgba(48, 209, 88, 0.15)' : 'rgba(52, 199, 89, 0.1)',
      color: colors.green,
    },
    stepPending: {
      background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      color: colors.textMuted,
    },
    stepFailed: {
      background: darkMode ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 59, 48, 0.1)',
      color: colors.red,
    },
    outputCard: {
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      overflow: 'hidden',
    },
    outputHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${colors.border}`,
      background: darkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
    },
    outputMeta: {
      display: 'flex',
      gap: '16px',
      fontSize: '12px',
      color: colors.textMuted,
    },
    outputMetaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    outputContent: {
      padding: '20px',
      maxHeight: '500px',
      overflowY: 'auto' as const,
      fontSize: '14px',
      lineHeight: 1.7,
      color: colors.text,
      whiteSpace: 'pre-wrap' as const,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
    },
    badgeGreen: {
      background: darkMode ? 'rgba(48, 209, 88, 0.15)' : 'rgba(52, 199, 89, 0.12)',
      color: colors.green,
    },
    badgeRed: {
      background: darkMode ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 59, 48, 0.12)',
      color: colors.red,
    },
    copyButton: {
      padding: '6px 12px',
      fontSize: '12px',
      fontWeight: 500,
      color: colors.accent,
      background: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
  };

  // Check dev mode on mount
  useEffect(() => {
    debugOps.isDevMode().then(setIsDevMode).catch(() => setIsDevMode(false));
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Handle folder selection
  const handleSelectFolder = async () => {
    setError(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setSelectedFolder(selected);
        // Reset state when new folder selected
        setStatus('idle');
        setWorkflowRunId(null);
        setWorkflowRun(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to open folder picker: ${message}`);
    }
  };

  // Start generation
  const handleGenerate = async () => {
    if (!selectedFolder) return;

    // Stop any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setError(null);
    setStatus('queued');
    setWorkflowRun(null);

    try {
      // Get JWT from auth
      const jwt = getAccessToken();

      // Create workflow run - DO NOT log the input
      const response = await createWorkflowRun(
        {
          type: 'wf_prompt_run',
          confidentiality: 'confidential',
          context: {
            prompt_ref: PROMPT_CONFIG,
            variables: { input: selectedFolder },
          },
        },
        jwt
      );

      setWorkflowRunId(response.id);

      // Start polling
      startPolling(response.id, jwt);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start generation';
      setError(message);
      setStatus('failed');
    }
  };

  // Poll for status updates
  const startPolling = (id: string, jwt: string | null) => {
    const poll = async () => {
      try {
        const run = await getWorkflowRun(id, jwt);
        setWorkflowRun(run);

        // Update status based on workflow state
        if (run.status === 'completed') {
          setStatus('completed');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (run.status === 'failed') {
          setStatus('failed');
          setError(run.error || 'Workflow failed');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (run.status === 'running' || run.progress > 0) {
          setStatus('running');
        } else {
          setStatus('queued');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch status';
        setError(message);
        setStatus('failed');
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    };

    // Initial poll
    void poll();

    // Poll every 1.5 seconds
    pollingRef.current = window.setInterval(poll, 1500);
  };

  // Copy output to clipboard
  const handleCopyOutput = async () => {
    if (!workflowRun?.result?.output_text) return;

    try {
      await navigator.clipboard.writeText(workflowRun.result?.output_text || '');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const isGenerating = status === 'queued' || status === 'running';
  const canGenerate = selectedFolder && !isGenerating;

  return (
    <div style={styles.container}>
      {/* CSS for spinner animation */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <header style={styles.header}>
        <h1 style={styles.title}>Generate Documentation</h1>
        <p style={styles.subtitle}>
          Select a source folder to automatically generate documentation using AI.
          The generated documentation will be displayed below.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {/* Section: Folder Selection */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Source Folder</span>
          <div style={styles.sectionLine} />
        </div>
        <div style={styles.card}>
          <div style={styles.folderSelector}>
            <div style={styles.selectedFolderBox}>
              {selectedFolder ? (
                selectedFolder
              ) : (
                <span style={styles.placeholderText}>No folder selected</span>
              )}
            </div>
            <button
              onClick={() => void handleSelectFolder()}
              style={styles.buttonSecondary}
              disabled={isGenerating}
            >
              Browse...
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => void handleGenerate()}
              style={{
                ...styles.button,
                ...(!canGenerate ? styles.buttonDisabled : {}),
              }}
              disabled={!canGenerate}
            >
              {isGenerating ? 'Generating...' : 'Generate Documentation'}
            </button>
          </div>
        </div>
      </div>

      {/* Section: Progress */}
      {(status !== 'idle' || workflowRunId) && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Progress</span>
            <div style={styles.sectionLine} />
          </div>
          <div style={styles.progressCard}>
            <div style={styles.progressHeader}>
              {isGenerating && <div style={styles.progressSpinner} />}
              {status === 'completed' && <CheckIcon color={colors.green} />}
              {status === 'failed' && <ErrorIcon color={colors.red} />}
              <span style={styles.progressTitle}>
                {status === 'queued' && 'Queued'}
                {status === 'running' && 'Processing...'}
                {status === 'completed' && 'Completed'}
                {status === 'failed' && 'Failed'}
              </span>
              {workflowRunId && (
                <span style={{ fontSize: '11px', color: colors.textMuted, fontFamily: 'monospace' }}>
                  ID: {workflowRunId.slice(0, 8)}...
                </span>
              )}
            </div>
            <div style={styles.progressSteps}>
              <div
                style={{
                  ...styles.progressStep,
                  ...(status === 'queued' ? styles.stepActive : styles.stepComplete),
                }}
              >
                {status !== 'queued' && <CheckIcon color={colors.green} size={12} />}
                Queued
              </div>
              <div
                style={{
                  ...styles.progressStep,
                  ...(status === 'running'
                    ? styles.stepActive
                    : status === 'completed' || status === 'failed'
                      ? status === 'failed'
                        ? styles.stepFailed
                        : styles.stepComplete
                      : styles.stepPending),
                }}
              >
                {status === 'completed' && <CheckIcon color={colors.green} size={12} />}
                {status === 'failed' && <ErrorIcon color={colors.red} size={12} />}
                Running
              </div>
              <div
                style={{
                  ...styles.progressStep,
                  ...(status === 'completed'
                    ? styles.stepComplete
                    : status === 'failed'
                      ? styles.stepFailed
                      : styles.stepPending),
                }}
              >
                {status === 'completed' && <CheckIcon color={colors.green} size={12} />}
                {status === 'failed' && <ErrorIcon color={colors.red} size={12} />}
                {status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : 'Complete'}
              </div>
            </div>
            {workflowRun && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: colors.textMuted }}>
                Progress: {workflowRun.progress}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section: Output */}
      {status === 'completed' && workflowRun?.result?.output_text && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Generated Documentation</span>
            <div style={styles.sectionLine} />
          </div>
          <div style={styles.outputCard}>
            <div style={styles.outputHeader}>
              <div style={styles.outputMeta}>
                <div style={styles.outputMetaItem}>
                  <span style={{ ...styles.badge, ...styles.badgeGreen }}>Completed</span>
                </div>
                <div style={styles.outputMetaItem}>
                  <span style={{ color: colors.textDim }}>ID:</span>
                  <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {workflowRunId}
                  </code>
                </div>
              </div>
              <button
                onClick={() => void handleCopyOutput()}
                style={styles.copyButton}
              >
                {copySuccess ? (
                  <>
                    <CheckIcon color={colors.green} size={14} />
                    Copied!
                  </>
                ) : (
                  <>
                    <CopyIcon />
                    Copy Output
                  </>
                )}
              </button>
            </div>
            <div style={styles.outputContent}>{workflowRun.result?.output_text}</div>
          </div>
        </div>
      )}

      {/* Section: Error Details */}
      {status === 'failed' && workflowRun && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Error Details</span>
            <div style={styles.sectionLine} />
          </div>
          <div style={{ ...styles.card, borderColor: colors.red }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ ...styles.badge, ...styles.badgeRed }}>
                ERROR
              </span>
            </div>
            <p style={{ fontSize: '14px', color: colors.text, margin: 0 }}>
              {workflowRun.error || 'An unknown error occurred'}
            </p>
          </div>
        </div>
      )}

      {/* Section: Debug Bundle (Dev Mode Only) */}
      {status === 'failed' && isDevMode && workflowRun?.result?.debug_bundle && (
        <DebugBundleSection
          debugBundle={workflowRun.result.debug_bundle}
          darkMode={darkMode}
          colors={colors}
          pathCopySuccess={pathCopySuccess}
          onCopyPath={async () => {
            try {
              await navigator.clipboard.writeText(workflowRun.result?.debug_bundle?.debug_bundle_ref || '');
              setPathCopySuccess(true);
              setTimeout(() => setPathCopySuccess(false), 2000);
            } catch {
              setError('Failed to copy path to clipboard');
            }
          }}
          onOpenFolder={async () => {
            try {
              await debugOps.openFolder(workflowRun.result?.debug_bundle?.debug_bundle_ref || '');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to open folder');
            }
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Debug Bundle Section (Dev Mode Only)
// =============================================================================

interface DebugBundleSectionProps {
  debugBundle: DebugBundleInfo;
  darkMode: boolean;
  colors: Record<string, string>;
  pathCopySuccess: boolean;
  onCopyPath: () => void;
  onOpenFolder: () => void;
}

function DebugBundleSection({
  debugBundle,
  darkMode,
  colors,
  pathCopySuccess,
  onCopyPath,
  onOpenFolder,
}: DebugBundleSectionProps): ReactElement {
  const styles: Record<string, CSSProperties> = {
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
      background: darkMode ? '#1c1c1e' : '#fafafa',
      border: `1px solid ${darkMode ? '#48484a' : '#d1d1d6'}`,
      borderRadius: '12px',
      padding: '16px',
    },
    devBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 600,
      background: darkMode ? 'rgba(191, 90, 242, 0.15)' : 'rgba(175, 82, 222, 0.12)',
      color: darkMode ? '#bf5af2' : '#af52de',
      marginBottom: '12px',
    },
    pathBox: {
      padding: '10px 12px',
      background: darkMode ? '#2c2c2e' : '#ffffff',
      border: `1px solid ${darkMode ? '#3a3a3c' : '#e5e5e5'}`,
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      color: colors.text,
      marginBottom: '12px',
      wordBreak: 'break-all' as const,
    },
    row: {
      display: 'flex',
      gap: '12px',
      marginBottom: '12px',
    },
    metaItem: {
      fontSize: '12px',
      color: colors.textMuted,
    },
    metaLabel: {
      fontWeight: 500,
      marginRight: '4px',
    },
    metaValue: {
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      fontSize: '11px',
    },
    filesList: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '6px',
      marginBottom: '16px',
    },
    fileTag: {
      padding: '4px 8px',
      background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      borderRadius: '4px',
      fontSize: '11px',
      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
      color: colors.textMuted,
    },
    buttonRow: {
      display: 'flex',
      gap: '8px',
    },
    button: {
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 500,
      color: colors.accent,
      background: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>Debug Bundle</span>
        <div style={styles.sectionLine} />
      </div>
      <div style={styles.card}>
        <div style={styles.devBadge}>
          <span>🔧</span>
          DEV MODE ONLY
        </div>

        <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '8px' }}>
          Path (Local)
        </div>
        <div style={styles.pathBox}>
          {debugBundle.debug_bundle_ref}
        </div>

        <div style={styles.row}>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>Size:</span>
            <span style={styles.metaValue}>{formatBytes(debugBundle.raw_output_len)}</span>
          </div>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>SHA256:</span>
            <span style={styles.metaValue}>{debugBundle.raw_output_sha256.slice(0, 16)}...</span>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '6px' }}>
          Files
        </div>
        <div style={styles.filesList}>
          {debugBundle.files.map((file) => (
            <span key={file} style={styles.fileTag}>{file}</span>
          ))}
        </div>

        <div style={styles.buttonRow}>
          <button onClick={onOpenFolder} style={styles.button}>
            <FolderIcon />
            Open Folder
          </button>
          <button onClick={onCopyPath} style={styles.button}>
            {pathCopySuccess ? (
              <>
                <CheckIcon color={colors.green} size={14} />
                Copied!
              </>
            ) : (
              <>
                <CopyIcon />
                Copy Path
              </>
            )}
          </button>
        </div>

        <div style={{ marginTop: '12px', fontSize: '11px', color: colors.textDim, fontStyle: 'italic' }}>
          Raw output is NOT displayed here. Open the folder to inspect files.
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function FolderIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M.54 3.87.5 14a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V4.5a1 1 0 0 0-1-1H7.414A2 2 0 0 1 6 2.5L5.5 2a2 2 0 0 0-1.414-.586H1.5a1 1 0 0 0-1 1l.04 1.456z"/>
    </svg>
  );
}

// Icons
function CheckIcon({ color, size = 16 }: { color: string; size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
    </svg>
  );
}

function ErrorIcon({ color, size = 16 }: { color: string; size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
      <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
    </svg>
  );
}

function CopyIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z" />
      <path d="M2 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4z" />
    </svg>
  );
}
