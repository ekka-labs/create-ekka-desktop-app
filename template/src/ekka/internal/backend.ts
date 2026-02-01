/**
 * EKKA Internal Backend
 *
 * SmartBackend auto-detects engine vs demo mode on connect.
 * This module is NOT exported publicly - only accessible via _internal.
 */

import type { EngineRequest, EngineResponse } from '../types';
import { err, makeRequest } from '../types';
import { DemoBackend } from '../backend/demo';

/**
 * Transport mode - determined on connect.
 */
export type TransportMode = 'unknown' | 'engine' | 'demo';

/**
 * SmartBackend - single backend that auto-detects engine vs demo.
 *
 * On connect():
 * - Tries to connect to Tauri engine
 * - If successful: engine mode
 * - If fails: demo mode (in-memory)
 */
class SmartBackend {
  private mode: TransportMode = 'unknown';
  private connected = false;
  private demoBackend = new DemoBackend();

  /**
   * Connect to the backend.
   * Auto-detects engine vs demo mode.
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    // Try engine first (only works in Tauri with engine present)
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('engine_connect');
      this.mode = 'engine';
      this.connected = true;
      return;
    } catch {
      // Engine not available - use demo mode
    }

    // Fall back to demo mode
    this.mode = 'demo';
    await this.demoBackend.connect();
    this.connected = true;
  }

  /**
   * Disconnect from the backend.
   */
  disconnect(): void {
    if (!this.connected) return;

    if (this.mode === 'engine') {
      // Fire and forget
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('engine_disconnect'))
        .catch(() => {});
    } else {
      this.demoBackend.disconnect();
    }

    this.connected = false;
    this.mode = 'unknown';
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current transport mode.
   */
  getMode(): TransportMode {
    return this.mode;
  }

  /**
   * Send a request to the backend.
   */
  async request(req: EngineRequest): Promise<EngineResponse> {
    if (!this.connected) {
      return err('NOT_CONNECTED', 'Not connected. Call ekka.connect() first.');
    }

    if (this.mode === 'engine') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<EngineResponse>('engine_request', { req });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown invoke error';
        return err('INTERNAL_ERROR', message);
      }
    }

    // Demo mode
    return this.demoBackend.request(req);
  }
}

// =============================================================================
// INTERNAL API (not exported from package)
// =============================================================================

const backend = new SmartBackend();

/**
 * Internal API - only accessible within the ekka package.
 * NOT exported from the main index.ts.
 */
export const _internal = {
  connect: () => backend.connect(),
  disconnect: () => backend.disconnect(),
  isConnected: () => backend.isConnected(),
  getMode: () => backend.getMode(),
  request: (req: EngineRequest) => backend.request(req),
};

// Re-export makeRequest for use by index.ts
export { makeRequest };
