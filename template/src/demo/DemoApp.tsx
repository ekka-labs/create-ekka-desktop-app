/**
 * EKKA Demo App
 * SAFE TO DELETE - This is just a demo
 *
 * This demonstrates the ekka client API.
 * Delete this directory and modify src/app/App.tsx to build your own UI.
 */

import { useState, useEffect } from 'react';
import { ekka, EkkaError } from '../ekka';
import { Settings } from './Settings';

type Tab = 'demo' | 'settings';

interface DemoState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  dbValue: string | null;
  queueJobId: string | null;
}

export function DemoApp() {
  const [tab, setTab] = useState<Tab>('demo');
  const [state, setState] = useState<DemoState>({
    connected: false,
    connecting: false,
    error: null,
    dbValue: null,
    queueJobId: null,
  });

  const [inputKey, setInputKey] = useState('demo-key');
  const [inputValue, setInputValue] = useState('Hello EKKA!');
  const [queueKind, setQueueKind] = useState('demo-job');
  const [queuePayload, setQueuePayload] = useState('{"message": "Hello from queue"}');

  // Connect on mount
  useEffect(() => {
    handleConnect();
  }, []);

  async function handleConnect() {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      await ekka.connect();
      setState((s) => ({ ...s, connected: true, connecting: false }));
    } catch (err) {
      const message = err instanceof EkkaError ? err.message : 'Unknown error';
      setState((s) => ({ ...s, connecting: false, error: message }));
    }
  }

  async function handleDbPut() {
    try {
      await ekka.db.put(inputKey, inputValue);
      setState((s) => ({ ...s, error: null }));
    } catch (err) {
      const message = err instanceof EkkaError ? err.message : 'Unknown error';
      setState((s) => ({ ...s, error: message }));
    }
  }

  async function handleDbGet() {
    try {
      const value = await ekka.db.get<string>(inputKey);
      setState((s) => ({ ...s, dbValue: value, error: null }));
    } catch (err) {
      const message = err instanceof EkkaError ? err.message : 'Unknown error';
      setState((s) => ({ ...s, error: message }));
    }
  }

  async function handleQueueEnqueue() {
    try {
      const payload = JSON.parse(queuePayload);
      const jobId = await ekka.queue.enqueue(queueKind, payload);
      setState((s) => ({ ...s, queueJobId: jobId, error: null }));
    } catch (err) {
      const message = err instanceof EkkaError ? err.message : 'Unknown error';
      setState((s) => ({ ...s, error: message }));
    }
  }

  async function handleQueueClaim() {
    try {
      const job = await ekka.queue.claim();
      if (job) {
        setState((s) => ({ ...s, queueJobId: job.id, error: null }));
        // Auto-ack for demo
        await ekka.queue.ack(job);
      } else {
        setState((s) => ({ ...s, queueJobId: null, error: 'No jobs in queue' }));
      }
    } catch (err) {
      const message = err instanceof EkkaError ? err.message : 'Unknown error';
      setState((s) => ({ ...s, error: message }));
    }
  }

  const styles = {
    container: {
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '680px',
      margin: '0 auto',
      color: '#1a1a1a',
    },
    hero: {
      marginBottom: '3rem',
      paddingBottom: '2rem',
      borderBottom: '1px solid #e5e5e5',
    },
    heroTitle: {
      fontSize: '1.75rem',
      fontWeight: 600,
      marginBottom: '1rem',
      color: '#111',
    },
    heroText: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: '#444',
    },
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
    controls: {
      padding: '1.25rem',
      background: '#fafafa',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
    },
    inputRow: {
      marginBottom: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    label: {
      fontSize: '0.875rem',
      color: '#333',
      minWidth: '60px',
    },
    input: {
      padding: '0.5rem 0.75rem',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '0.875rem',
      flex: 1,
      maxWidth: '280px',
    },
    buttonRow: {
      display: 'flex',
      gap: '0.5rem',
      marginTop: '1rem',
    },
    button: {
      padding: '0.5rem 1rem',
      background: '#111',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontSize: '0.875rem',
      cursor: 'pointer',
    },
    buttonDisabled: {
      background: '#999',
      cursor: 'not-allowed',
    },
    result: {
      marginTop: '1rem',
      padding: '0.75rem',
      background: '#f0f7ff',
      borderRadius: '4px',
      fontSize: '0.875rem',
    },
    error: {
      padding: '0.875rem',
      marginBottom: '1.5rem',
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '6px',
      color: '#991b1b',
      fontSize: '0.875rem',
    },
    footer: {
      marginTop: '3rem',
      paddingTop: '1.5rem',
      borderTop: '1px solid #e5e5e5',
    },
    footerTitle: {
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#666',
      marginBottom: '0.5rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    footerText: {
      fontSize: '0.8rem',
      color: '#888',
      lineHeight: 1.5,
    },
    tabs: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '2rem',
    },
    tab: {
      padding: '0.5rem 1rem',
      background: 'transparent',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '0.875rem',
      color: '#666',
      cursor: 'pointer',
    },
    tabActive: {
      background: '#111',
      color: '#fff',
      border: '1px solid #111',
    },
  };

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <header style={styles.hero}>
        <h1 style={styles.heroTitle}>EKKA Desktop — Live Execution Demo</h1>
        <p style={styles.heroText}>
          EKKA executes work through a governed, auditable environment. This demo
          illustrates core capabilities: storing and retrieving data, and processing
          work through queues. Try the interactions below to see these patterns in action.
        </p>
      </header>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'demo' ? styles.tabActive : {}) }}
          onClick={() => setTab('demo')}
        >
          Demo
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'settings' ? styles.tabActive : {}) }}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && <Settings />}

      {/* Demo Tab */}
      {tab === 'demo' && (
        <>
          {/* Error Display */}
          {state.error && (
            <div style={styles.error}>
              {state.error}
            </div>
          )}

          {/* Chapter 1: Stateful Data */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Stateful Data</h2>
            <p style={styles.sectionContext}>
              Applications need to persist and retrieve information. EKKA provides a
              key-value store that your code accesses through a consistent API, with
              all operations subject to policy enforcement.
            </p>
            <div style={styles.controls}>
              <div style={styles.inputRow}>
                <label style={styles.label}>Key</label>
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  style={styles.input}
                  placeholder="Enter a key"
                />
              </div>
              <div style={styles.inputRow}>
                <label style={styles.label}>Value</label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  style={styles.input}
                  placeholder="Enter a value"
                />
              </div>
              <div style={styles.buttonRow}>
                <button
                  onClick={handleDbPut}
                  disabled={!state.connected}
                  style={{
                    ...styles.button,
                    ...(state.connected ? {} : styles.buttonDisabled),
                  }}
                >
                  Store
                </button>
                <button
                  onClick={handleDbGet}
                  disabled={!state.connected}
                  style={{
                    ...styles.button,
                    ...(state.connected ? {} : styles.buttonDisabled),
                  }}
                >
                  Retrieve
                </button>
              </div>
              {state.dbValue !== null && (
                <div style={styles.result}>
                  Retrieved: <code>{state.dbValue}</code>
                </div>
              )}
            </div>
          </section>

          {/* Chapter 2: Asynchronous Work */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Asynchronous Work</h2>
            <p style={styles.sectionContext}>
              Long-running tasks are managed through job queues. Producers enqueue work;
              consumers claim and process jobs. This decoupling enables reliable,
              scalable task execution.
            </p>
            <div style={styles.controls}>
              <div style={styles.inputRow}>
                <label style={styles.label}>Type</label>
                <input
                  type="text"
                  value={queueKind}
                  onChange={(e) => setQueueKind(e.target.value)}
                  style={styles.input}
                  placeholder="Job type"
                />
              </div>
              <div style={styles.inputRow}>
                <label style={styles.label}>Payload</label>
                <input
                  type="text"
                  value={queuePayload}
                  onChange={(e) => setQueuePayload(e.target.value)}
                  style={{ ...styles.input, maxWidth: '320px' }}
                  placeholder="JSON payload"
                />
              </div>
              <div style={styles.buttonRow}>
                <button
                  onClick={handleQueueEnqueue}
                  disabled={!state.connected}
                  style={{
                    ...styles.button,
                    ...(state.connected ? {} : styles.buttonDisabled),
                  }}
                >
                  Enqueue
                </button>
                <button
                  onClick={handleQueueClaim}
                  disabled={!state.connected}
                  style={{
                    ...styles.button,
                    ...(state.connected ? {} : styles.buttonDisabled),
                  }}
                >
                  Claim & Complete
                </button>
              </div>
              {state.queueJobId && (
                <div style={styles.result}>
                  Job processed: <code>{state.queueJobId}</code>
                </div>
              )}
            </div>
          </section>

          {/* Footer: About this demo */}
          <footer style={styles.footer}>
            <h3 style={styles.footerTitle}>About this demo</h3>
            <p style={styles.footerText}>
              This is a self-contained demonstration. To build your own application,
              delete <code>src/demo/</code> and edit <code>src/app/App.tsx</code>.
              The <code>src/ekka/</code> directory contains managed code and should not be modified.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
