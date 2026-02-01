/**
 * Engine API Client
 *
 * Client for EKKA Engine workflow operations.
 * Uses security envelope headers for all requests.
 */

import { ENGINE_BASE_URL, CLIENT_TYPE, CLIENT_VERSION } from '../config';

// =============================================================================
// TYPES
// =============================================================================

export interface WorkflowRunCreateRequest {
  type: string;
  confidentiality: 'public' | 'confidential';
  context: {
    prompt_ref: {
      provider: string;
      prompt_slug: string;
      prompt_version: string;
    };
    variables: Record<string, string>;
  };
}

/** Debug bundle info (only present for REPORT_INVALID in dev mode) */
export interface DebugBundleInfo {
  /** Vault URI (e.g., "vault://tmp/telemetry/llm_debug/{tenant}/{run_id}/") */
  debug_bundle_ref: string;
  /** SHA256 hash of raw output */
  raw_output_sha256: string;
  /** Length of raw output in bytes */
  raw_output_len: number;
  /** Files in the bundle */
  files: string[];
}

export interface WorkflowRunResult {
  output_text?: string;
  /** Debug bundle info (only present for REPORT_INVALID failures in dev mode) */
  debug_bundle?: DebugBundleInfo;
  [key: string]: unknown;
}

export interface WorkflowRun {
  id: string;
  type?: string;
  workflow_definition_id?: string;
  status: 'pending' | 'dispatched' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: WorkflowRunResult;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface WorkflowRunCreateResponse {
  id: string;
  status: string;
}

// =============================================================================
// SECURITY HEADERS
// =============================================================================

function buildEngineHeaders(jwt: string | null): Record<string, string> {
  const correlationId = crypto.randomUUID();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-REQUEST-ID': correlationId,
    'X-EKKA-CORRELATION-ID': correlationId,
    'X-EKKA-PROOF-TYPE': jwt ? 'jwt' : 'none',
    'X-EKKA-MODULE': 'desktop.docgen',
    'X-EKKA-ACTION': 'workflow',
    'X-EKKA-CLIENT': CLIENT_TYPE,
    'X-EKKA-CLIENT-VERSION': CLIENT_VERSION,
  };

  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  return headers;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Create a new workflow run.
 *
 * @param request - Workflow run creation request
 * @param jwt - Optional JWT for authenticated requests
 * @returns Created workflow run with ID
 */
export async function createWorkflowRun(
  request: WorkflowRunCreateRequest,
  jwt: string | null = null
): Promise<WorkflowRunCreateResponse> {
  const url = `${ENGINE_BASE_URL}/engine/workflow-runs`;
  const headers = buildEngineHeaders(jwt);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
  } catch {
    // Network error - engine not reachable
    throw new Error(`Cannot connect to engine at ${ENGINE_BASE_URL}. Is the engine running?`);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || errorData.error || `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Get workflow run status and output.
 *
 * @param id - Workflow run ID
 * @param jwt - Optional JWT for authenticated requests
 * @returns Workflow run details
 */
export async function getWorkflowRun(
  id: string,
  jwt: string | null = null
): Promise<WorkflowRun> {
  const url = `${ENGINE_BASE_URL}/engine/workflow-runs/${id}`;
  const headers = buildEngineHeaders(jwt);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
    });
  } catch {
    // Network error - engine not reachable
    throw new Error(`Cannot connect to engine at ${ENGINE_BASE_URL}. Is the engine running?`);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || errorData.error || `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}
