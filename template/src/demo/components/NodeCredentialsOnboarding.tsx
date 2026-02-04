/**
 * Node Credentials Onboarding Component
 *
 * Minimal UI for one-time node_id + node_secret input.
 * Stores credentials securely in OS keychain.
 */

import { useState, useCallback } from 'react';
import { ekka } from '../../ekka';

interface NodeCredentialsOnboardingProps {
  /** Called when credentials are successfully saved */
  onComplete?: () => void;
  /** If true, renders without outer container (for embedding in wizard) */
  embedded?: boolean;
}

export function NodeCredentialsOnboarding({
  onComplete,
  embedded = false,
}: NodeCredentialsOnboardingProps) {
  const [nodeId, setNodeId] = useState('');
  const [nodeSecret, setNodeSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validation states
  const nodeIdValid = ekka.nodeCredentials.isValidNodeId(nodeId);
  const nodeSecretValid = ekka.nodeCredentials.isValidNodeSecret(nodeSecret);
  const canSubmit = nodeIdValid && nodeSecretValid && !loading;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        await ekka.nodeCredentials.set(nodeId, nodeSecret);
        setSuccess(true);
        onComplete?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save credentials');
      } finally {
        setLoading(false);
      }
    },
    [nodeId, nodeSecret, onComplete]
  );

  const successContent = (
    <div style={styles.card}>
      <div style={styles.successIcon}>&#10003;</div>
      <h2 style={styles.title}>Node Configured</h2>
      <p style={styles.text}>
        Your node credentials have been saved securely.
        The engine will use them automatically on startup.
      </p>
    </div>
  );

  if (success) {
    return embedded ? successContent : <div style={styles.container}>{successContent}</div>;
  }

  const formContent = (
    <div style={styles.card}>
        <h2 style={styles.title}>Configure Node Identity</h2>
        <p style={styles.text}>
          Enter your node credentials to enable headless engine startup.
          These will be stored securely in your system keychain.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Node ID</label>
            <input
              type="text"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value.trim())}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{
                ...styles.input,
                borderColor: nodeId && !nodeIdValid ? '#ef4444' : '#d1d5db',
              }}
              disabled={loading}
            />
            {nodeId && !nodeIdValid && (
              <span style={styles.error}>Must be a valid UUID</span>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Node Secret</label>
            <input
              type="password"
              value={nodeSecret}
              onChange={(e) => setNodeSecret(e.target.value)}
              placeholder="Enter node secret"
              style={{
                ...styles.input,
                borderColor: nodeSecret && !nodeSecretValid ? '#ef4444' : '#d1d5db',
              }}
              disabled={loading}
            />
            {nodeSecret && !nodeSecretValid && (
              <span style={styles.error}>Must be at least 16 characters</span>
            )}
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...styles.button,
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Saving...' : 'Save Credentials'}
          </button>
        </form>
      </div>
  );

  return embedded ? formContent : <div style={styles.container}>{formContent}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '1rem',
    backgroundColor: '#f3f4f6',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '0.5rem',
    padding: '2rem',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#111827',
  },
  text: {
    margin: '0 0 1.5rem 0',
    fontSize: '0.875rem',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    outline: 'none',
    fontFamily: 'monospace',
  },
  error: {
    fontSize: '0.75rem',
    color: '#ef4444',
  },
  errorBox: {
    padding: '0.75rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: '#b91c1c',
  },
  button: {
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '0.375rem',
    marginTop: '0.5rem',
  },
  successIcon: {
    width: '3rem',
    height: '3rem',
    lineHeight: '3rem',
    textAlign: 'center',
    fontSize: '1.5rem',
    color: '#ffffff',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    margin: '0 auto 1rem auto',
  },
};

export default NodeCredentialsOnboarding;
