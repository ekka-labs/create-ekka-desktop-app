/**
 * Runtime Operations
 *
 * Wraps Rust ops/runtime.rs
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

export interface RuntimeInfo {
  runtime: string;
  engine_present: boolean;
  mode: string;
  homeState: string;
  homePath: string;
}

/**
 * Get runtime info.
 * Maps to Rust: runtime.info
 */
export async function info(): Promise<RuntimeInfo> {
  const req = makeRequest(OPS.RUNTIME_INFO, {});
  const response = await _internal.request(req);

  if (!response.ok) {
    throw new Error(response.error?.message || 'Failed to get runtime info');
  }

  return response.result as RuntimeInfo;
}
