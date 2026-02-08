/**
 * Execution Plans Page
 *
 * Generic execution plan runner demo:
 * - Select a plan from dropdown
 * - Edit input JSON
 * - Execute (start a run)
 * - View runs grid + run details/events
 */

import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactElement } from 'react';
import { _internal, makeRequest } from '../../ekka/internal';
import { InfoTooltip } from '../components';

// =============================================================================
// API HELPERS (use internal request wrapper, no direct fetch)
// =============================================================================

interface Plan {
  id: string;
  plan_code: string;
  display_name: string;
  classification?: string;
  description?: string;
  input_schema?: { required?: string[]; properties?: Record<string, unknown> };
  steps?: unknown[];
}

interface Run {
  id: string;
  plan_id: string;
  status: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
}

interface RunEvent {
  id: string;
  run_id: string;
  event_type: string;
  step_key?: string;
  payload?: unknown;
  created_at: string;
}

async function request<T>(op: string, payload: unknown = {}): Promise<T> {
  const req = makeRequest(op, payload);
  const resp = await _internal.request(req);
  if (!resp.ok) {
    throw new Error(resp.error?.message || `${op} failed`);
  }
  return resp.result as T;
}

async function listPlans(): Promise<Plan[]> {
  const result = await request<{ data?: Plan[]; plans?: Plan[] }>('execution.plans.list', { limit: 100 });
  return result.data || result.plans || (Array.isArray(result) ? result as unknown as Plan[] : []);
}

async function getPlan(id: string): Promise<Plan> {
  return request<Plan>('execution.plans.get', { id });
}

async function listRuns(planId: string): Promise<Run[]> {
  const result = await request<{ data?: Run[]; runs?: Run[] }>('execution.plans.runs.list', { planId, limit: 25 });
  return result.data || result.runs || (Array.isArray(result) ? result as unknown as Run[] : []);
}

async function startRun(plan_id: string, inputs: Record<string, unknown>): Promise<Run> {
  return request<Run>('execution.runs.start', { plan_id, inputs });
}

async function getRun(runId: string): Promise<Run> {
  return request<Run>('execution.runs.get', { runId });
}

async function getRunEvents(runId: string): Promise<RunEvent[]> {
  const result = await request<{ data?: RunEvent[]; events?: RunEvent[] }>('execution.runs.events', { runId });
  return result.data || result.events || (Array.isArray(result) ? result as unknown as RunEvent[] : []);
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

interface ExecutionPlansPageProps {
  darkMode: boolean;
}

export function ExecutionPlansPage({ darkMode }: ExecutionPlansPageProps): ReactElement {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [inputJson, setInputJson] = useState<string>('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didLoadRef = useRef(false);

  // Colors
  const colors = {
    bg: darkMode ? '#1c1c1e' : '#ffffff',
    cardBg: darkMode ? '#2c2c2e' : '#fafafa',
    border: darkMode ? '#3a3a3c' : '#e5e5e5',
    text: darkMode ? '#ffffff' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#6e6e73',
    blue: darkMode ? '#0a84ff' : '#007aff',
    green: darkMode ? '#30d158' : '#34c759',
    red: darkMode ? '#ff453a' : '#ff3b30',
    yellow: darkMode ? '#ffd60a' : '#ff9f0a',
    inputBg: darkMode ? '#1c1c1e' : '#ffffff',
  };

  const styles: Record<string, CSSProperties> = {
    container: { padding: '24px 32px', maxWidth: '1200px', color: colors.text },
    header: { marginBottom: '24px' },
    title: { fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 },
    subtitle: { fontSize: '13px', color: colors.textMuted, marginTop: '4px' },
    error: { padding: '10px 14px', background: darkMode ? '#3c1618' : '#fef2f2', border: `1px solid ${darkMode ? '#7f1d1d' : '#fecaca'}`, borderRadius: '6px', fontSize: '13px', color: darkMode ? '#fca5a5' : '#991b1b', marginBottom: '16px' },
    card: { background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' },
    label: { fontSize: '12px', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', display: 'block' },
    select: { width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text, outline: 'none' },
    textarea: { width: '100%', minHeight: '120px', padding: '10px 12px', fontSize: '12px', fontFamily: 'SF Mono, Menlo, monospace', borderRadius: '6px', border: `1px solid ${jsonError ? colors.red : colors.border}`, background: colors.inputBg, color: colors.text, outline: 'none', resize: 'vertical' as const, lineHeight: 1.5 },
    button: { padding: '8px 20px', fontSize: '13px', fontWeight: 500, borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' },
    buttonPrimary: { background: colors.blue, color: '#ffffff' },
    buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px' },
    th: { textAlign: 'left' as const, padding: '8px 10px', borderBottom: `1px solid ${colors.border}`, fontWeight: 600, color: colors.textMuted, fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
    td: { padding: '8px 10px', borderBottom: `1px solid ${colors.border}`, verticalAlign: 'top' as const },
    mono: { fontFamily: 'SF Mono, Menlo, monospace', fontSize: '11px' },
    badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 },
    sectionTitle: { fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' },
    meta: { fontSize: '12px', color: colors.textMuted, marginTop: '8px' },
    pre: { background: darkMode ? '#1c1c1e' : '#f5f5f7', border: `1px solid ${colors.border}`, borderRadius: '6px', padding: '12px', fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', overflow: 'auto', maxHeight: '300px', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const },
    link: { color: colors.blue, cursor: 'pointer', background: 'none', border: 'none', fontSize: '12px', fontFamily: 'SF Mono, Menlo, monospace', padding: 0 },
    row: { display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '12px' },
  };

  // Load plans on mount
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    setLoading(true);
    listPlans()
      .then((p) => {
        setPlans(p);
        // Restore last selected plan from localStorage
        const lastPlan = localStorage.getItem('ekka_exec_plan_id');
        if (lastPlan && p.some((x) => x.id === lastPlan)) {
          setSelectedPlanId(lastPlan);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // When plan selection changes, load plan details + runs
  useEffect(() => {
    if (!selectedPlanId) {
      setSelectedPlan(null);
      setRuns([]);
      return;
    }
    localStorage.setItem('ekka_exec_plan_id', selectedPlanId);
    setSelectedPlan(null);
    setSelectedRun(null);
    setRunEvents([]);

    getPlan(selectedPlanId)
      .then((p) => {
        setSelectedPlan(p);
        // Prefill input JSON from schema
        const defaults = buildDefaultInputs(p);
        const lastInputs = localStorage.getItem(`ekka_exec_inputs_${selectedPlanId}`);
        setInputJson(lastInputs || JSON.stringify(defaults, null, 2));
      })
      .catch((e) => setError(e.message));

    loadRuns(selectedPlanId);
  }, [selectedPlanId]);

  const loadRuns = useCallback((planId: string) => {
    listRuns(planId)
      .then(setRuns)
      .catch(() => setRuns([]));
  }, []);

  // Validate JSON on change
  useEffect(() => {
    try {
      JSON.parse(inputJson);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }, [inputJson]);

  // Execute
  async function handleExecute() {
    if (!selectedPlanId || jsonError) return;
    setExecuting(true);
    setError(null);
    try {
      const inputs = JSON.parse(inputJson);
      localStorage.setItem(`ekka_exec_inputs_${selectedPlanId}`, inputJson);
      await startRun(selectedPlanId, inputs);
      loadRuns(selectedPlanId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExecuting(false);
    }
  }

  // View run details
  async function handleViewRun(runId: string) {
    try {
      const [run, events] = await Promise.all([getRun(runId), getRunEvents(runId)]);
      setSelectedRun(run);
      setRunEvents(events);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function statusColor(status: string): string {
    if (status === 'completed' || status === 'succeeded') return colors.green;
    if (status === 'failed' || status === 'error') return colors.red;
    if (status === 'running' || status === 'in_progress') return colors.blue;
    if (status === 'pending' || status === 'queued') return colors.yellow;
    return colors.textMuted;
  }

  function shortId(id: string): string {
    return id.length > 12 ? id.slice(0, 8) + '...' : id;
  }

  function timeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Execution Plans <InfoTooltip text="Select a plan, configure inputs, and execute. Each run is tracked with status updates and an event timeline." darkMode={darkMode} /></h1>
        <p style={styles.subtitle}>Run execution plans against the engine and inspect results.</p>
      </header>

      {error && <div style={styles.error}>{error} <button onClick={() => setError(null)} style={{ ...styles.link, marginLeft: '8px' }}>dismiss</button></div>}

      {/* Plan Selector */}
      <div style={styles.card}>
        <span style={styles.label}>Select Plan</span>
        <select
          style={styles.select}
          value={selectedPlanId}
          onChange={(e) => setSelectedPlanId(e.target.value)}
          disabled={loading}
        >
          <option value="">{loading ? 'Loading plans...' : '— Select an execution plan —'}</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name || p.plan_code} [{p.classification || 'general'}]
            </option>
          ))}
        </select>
        {selectedPlan && (
          <div style={styles.meta}>
            <strong>{selectedPlan.display_name}</strong>
            {selectedPlan.description && <span> — {selectedPlan.description}</span>}
            {selectedPlan.steps && <span> ({(selectedPlan.steps as unknown[]).length} steps)</span>}
          </div>
        )}
      </div>

      {/* Input JSON + Execute */}
      {selectedPlanId && (
        <div style={styles.card}>
          <span style={styles.label}>Input JSON</span>
          <textarea
            style={styles.textarea}
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <div style={{ fontSize: '11px', color: colors.red, marginTop: '4px' }}>{jsonError}</div>}
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button
              style={{ ...styles.button, ...styles.buttonPrimary, ...(executing || !!jsonError ? styles.buttonDisabled : {}) }}
              onClick={handleExecute}
              disabled={executing || !!jsonError}
            >
              {executing ? 'Starting...' : 'Execute'}
            </button>
            <button
              style={{ ...styles.button, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text }}
              onClick={() => loadRuns(selectedPlanId)}
            >
              Refresh Runs
            </button>
          </div>
        </div>
      )}

      {/* Runs Grid */}
      {selectedPlanId && runs.length > 0 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Runs ({runs.length})</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Run ID</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td style={{ ...styles.td, ...styles.mono }}>{shortId(run.id)}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: `${statusColor(run.status)}20`, color: statusColor(run.status) }}>
                      {run.status}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: colors.textMuted }}>{timeAgo(run.created_at)}</td>
                  <td style={styles.td}>
                    <button style={styles.link} onClick={() => handleViewRun(run.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlanId && runs.length === 0 && !loading && (
        <div style={{ ...styles.card, color: colors.textMuted, textAlign: 'center', padding: '32px' }}>
          No runs yet. Click Execute to start one.
        </div>
      )}

      {/* Run Detail Panel */}
      {selectedRun && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={styles.sectionTitle}>
              Run Detail
              <span style={{ ...styles.badge, background: `${statusColor(selectedRun.status)}20`, color: statusColor(selectedRun.status) }}>
                {selectedRun.status}
              </span>
            </div>
            <button style={styles.link} onClick={() => { setSelectedRun(null); setRunEvents([]); }}>Close</button>
          </div>

          <div style={{ ...styles.grid, marginBottom: '16px' }}>
            <div>
              <span style={styles.label}>Run ID</span>
              <div style={styles.mono}>{selectedRun.id}</div>
            </div>
            <div>
              <span style={styles.label}>Created</span>
              <div style={{ fontSize: '12px' }}>{new Date(selectedRun.created_at).toLocaleString()}</div>
            </div>
          </div>

          {selectedRun.error && (
            <div style={{ ...styles.error, marginBottom: '12px' }}>
              <strong>Error:</strong> {selectedRun.error}
            </div>
          )}

          {selectedRun.outputs && Object.keys(selectedRun.outputs).length > 0 && (
            <>
              <span style={styles.label}>Outputs</span>
              <pre style={styles.pre}>{JSON.stringify(selectedRun.outputs, null, 2)}</pre>
            </>
          )}

          {/* Events Timeline */}
          <div style={{ marginTop: '16px' }}>
            <div style={styles.sectionTitle}>
              Events ({runEvents.length})
              <button style={styles.link} onClick={() => handleViewRun(selectedRun.id)}>Refresh</button>
            </div>
            {runEvents.length === 0 ? (
              <div style={{ color: colors.textMuted, fontSize: '12px' }}>No events yet.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Step</th>
                    <th style={styles.th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {runEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ ...styles.td, ...styles.mono, whiteSpace: 'nowrap' }}>
                        {new Date(ev.created_at).toLocaleTimeString()}
                      </td>
                      <td style={{ ...styles.td, ...styles.mono }}>{ev.event_type}</td>
                      <td style={{ ...styles.td, ...styles.mono, color: colors.textMuted }}>{ev.step_key || '—'}</td>
                      <td style={{ ...styles.td, fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.payload ? (typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload).slice(0, 120)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function buildDefaultInputs(plan: Plan): Record<string, unknown> {
  if (plan.input_schema?.properties) {
    const defaults: Record<string, unknown> = {};
    const required = new Set(plan.input_schema.required || []);
    for (const [key, schema] of Object.entries(plan.input_schema.properties)) {
      const s = schema as Record<string, unknown>;
      if (required.has(key) || Object.keys(plan.input_schema.properties).length <= 5) {
        defaults[key] = s.default !== undefined ? s.default : (s.type === 'number' ? 0 : s.type === 'boolean' ? false : '');
      }
    }
    return defaults;
  }
  return {};
}
