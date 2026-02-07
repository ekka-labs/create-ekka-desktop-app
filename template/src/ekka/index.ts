/**
 * EKKA Client
 *
 * Simple API for frontend developers.
 *
 * @example
 * ```typescript
 * import { ekka } from '@ekka/client';
 *
 * // Connect and setup
 * await ekka.connect();
 * await ekka.auth.login('user@example.com', 'password');
 * await ekka.home.setup();
 *
 * // Check status
 * const ready = await ekka.home.isReady();
 * ```
 */

import { _internal } from './internal';
import * as authClient from './auth/client';
import * as ops from './ops';

// =============================================================================
// SIMPLE API (for most developers)
// =============================================================================

export const ekka = {
  // ---------------------------------------------------------------------------
  // Setup (pre-login device configuration)
  // ---------------------------------------------------------------------------

  setup: {
    /**
     * Get setup status.
     * Call before login to check if setup wizard is needed.
     * Returns { nodeIdentity, setupComplete }
     * Home folder grant is handled post-login via HomeSetupPage.
     */
    status: () => ops.setup.status(),
  },

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /** Connect to EKKA. Call this first. */
  connect: () => _internal.connect(),

  /** Disconnect from EKKA. */
  disconnect: () => _internal.disconnect(),

  /** Check if connected. */
  isConnected: () => _internal.isConnected(),

  // ---------------------------------------------------------------------------
  // Node Credentials (headless engine startup)
  // ---------------------------------------------------------------------------

  nodeCredentials: {
    /**
     * Set node credentials.
     * Stores node_id + node_secret in OS keychain.
     * Validates UUID format and secret length.
     */
    set: (nodeId: string, nodeSecret: string) =>
      ops.nodeCredentials.set({ nodeId, nodeSecret }),

    /**
     * Get credentials status.
     * Returns { hasCredentials, nodeId } - does NOT return secret.
     */
    status: () => ops.nodeCredentials.status(),

    /**
     * Clear credentials from keychain.
     */
    clear: () => ops.nodeCredentials.clear(),

    /**
     * Validate node_id format (UUID).
     */
    isValidNodeId: ops.nodeCredentials.isValidNodeId,

    /**
     * Validate node_secret format.
     */
    isValidNodeSecret: ops.nodeCredentials.isValidNodeSecret,
  },

  // ---------------------------------------------------------------------------
  // Auth (simple - login/logout)
  // ---------------------------------------------------------------------------

  auth: {
    /**
     * Login with email and password.
     * Handles HTTP auth + engine context setup + node session bootstrap automatically.
     *
     * After login:
     * 1. Sets engine auth context
     * 2. Bootstraps node session (Ed25519 challenge/response)
     * 3. Starts the runner automatically
     */
    login: async (identifier: string, password: string): Promise<void> => {
      const response = await authClient.login(identifier, password);

      // Set engine auth context
      const tenantId = response.user.company?.id || 'default';
      const sub = response.user.id;
      const jwt = response.access_token;

      // Use tenant_id as default workspace_id (can be overridden later)
      // TODO: Get workspace_id from JWT claims or user selection
      const workspaceId = tenantId;

      await ops.auth.setContext({ tenantId, sub, jwt, workspaceId });

      // Bootstrap node session and start runner
      try {
        await ops.nodeSession.bootstrap({ startRunner: true });
      } catch (e) {
        // Log but don't fail login - runner can be started later
        console.warn('[ekka] Node session bootstrap failed:', e);
      }
    },

    /** Logout and clear session. */
    logout: async (): Promise<void> => {
      await authClient.logout();
    },

    /** Check if logged in. */
    isLoggedIn: (): boolean => authClient.isAuthenticated(),

    /** Get current user info. */
    user: (): authClient.UserInfo | null => authClient.getCurrentUser(),
  },

  // ---------------------------------------------------------------------------
  // Home (simple - setup/isReady)
  // ---------------------------------------------------------------------------

  home: {
    /**
     * Set up home directory.
     * Just call this after login - it handles everything.
     */
    setup: () => ops.home.setup(),

    /**
     * Check if home is ready.
     * Returns true/false - no scary state machines.
     */
    isReady: () => ops.home.isReady(),
  },

  // ---------------------------------------------------------------------------
  // Paths (simple - check/allow access)
  // ---------------------------------------------------------------------------

  paths: {
    /**
     * Check if an operation is allowed on a path.
     * Returns true/false - simple boolean.
     */
    isAllowed: (path: string, operation?: string) =>
      ops.paths.isAllowed(path, operation),

    /**
     * List all path grants.
     */
    list: (type?: ops.paths.PathType) => ops.paths.list(type),

    /**
     * Get information about a specific path.
     */
    get: (path: string) => ops.paths.get(path),

    /**
     * Allow access to a path.
     * Requests a grant from the engine.
     */
    allow: (path: string, options?: ops.paths.PathRequestOptions) =>
      ops.paths.allow(path, options),

    /**
     * Remove a path grant.
     */
    remove: (path: string) => ops.paths.remove(path),
  },

  // ---------------------------------------------------------------------------
  // Vault (status, secrets, bundles, files, audit)
  // SECURITY: Secret values are NEVER returned by the API.
  // ---------------------------------------------------------------------------

  vault: {
    /** Get vault status */
    status: () => ops.vault.status(),

    /** Get vault capabilities */
    capabilities: () => ops.vault.capabilities(),

    /**
     * Secret operations (metadata only - values never returned)
     */
    secrets: {
      /** List all secrets (metadata only, NO values) */
      list: (opts?: ops.vault.SecretListOptions) => ops.vault.secrets.list(opts),
      /** Get a secret by ID (metadata only, NO value) */
      get: (id: string) => ops.vault.secrets.get(id),
      /** Create a new secret (value accepted here only) */
      create: (input: ops.vault.SecretCreateInput) => ops.vault.secrets.create(input),
      /** Update a secret (value accepted here only) */
      update: (id: string, input: ops.vault.SecretUpdateInput) => ops.vault.secrets.update(id, input),
      /** Delete a secret */
      delete: (id: string) => ops.vault.secrets.delete(id),
      /** Upsert a secret (create or update by name) */
      upsert: (input: ops.vault.SecretCreateInput) => ops.vault.secrets.upsert(input),
    },

    /**
     * Bundle operations (groups of related secrets)
     */
    bundles: {
      /** List all bundles */
      list: (opts?: ops.vault.BundleListOptions) => ops.vault.bundles.list(opts),
      /** Get a bundle by ID */
      get: (id: string) => ops.vault.bundles.get(id),
      /** Create a new bundle */
      create: (input: ops.vault.BundleCreateInput) => ops.vault.bundles.create(input),
      /** Rename a bundle */
      rename: (id: string, name: string) => ops.vault.bundles.rename(id, name),
      /** Delete a bundle */
      delete: (id: string) => ops.vault.bundles.delete(id),
      /** List secrets in a bundle */
      listSecrets: (bundleId: string, opts?: ops.vault.SecretListOptions) => ops.vault.bundles.listSecrets(bundleId, opts),
      /** Add a secret to a bundle */
      addSecret: (bundleId: string, secretId: string) => ops.vault.bundles.addSecret(bundleId, secretId),
      /** Remove a secret from a bundle */
      removeSecret: (bundleId: string, secretId: string) => ops.vault.bundles.removeSecret(bundleId, secretId),
    },

    /**
     * Files operations (encrypted file storage)
     * Paths are relative to workspace root. Chroot enforced.
     */
    files: {
      /** Write text content to a file */
      writeText: (path: string, content: string, opts?: ops.vault.FileOptions) =>
        ops.vault.files.writeText(path, content, opts),
      /** Write binary content to a file (content as base64) */
      writeBytes: (path: string, contentBytes: string, opts?: ops.vault.FileOptions) =>
        ops.vault.files.writeBytes(path, contentBytes, opts),
      /** Read text content from a file */
      readText: (path: string, opts?: ops.vault.FileOptions) =>
        ops.vault.files.readText(path, opts),
      /** Read binary content from a file (returns base64) */
      readBytes: (path: string, opts?: ops.vault.FileOptions) =>
        ops.vault.files.readBytes(path, opts),
      /** List files and directories */
      list: (dir: string, opts?: ops.vault.FileListOptions) =>
        ops.vault.files.list(dir, opts),
      /** Check if a file or directory exists */
      exists: (path: string, opts?: ops.vault.FileOptions) =>
        ops.vault.files.exists(path, opts),
      /** Delete a file or directory */
      delete: (path: string, opts?: ops.vault.FileDeleteOptions) =>
        ops.vault.files.delete(path, opts),
      /** Create a directory */
      mkdir: (path: string, opts?: ops.vault.FileOptions) =>
        ops.vault.files.mkdir(path, opts),
      /** Move a file or directory */
      move: (from: string, to: string, opts?: ops.vault.FileOptions) =>
        ops.vault.files.move(from, to, opts),
    },

    /**
     * Attach secrets to a connector (DEFERRED - returns NOT_IMPLEMENTED)
     */
    attachSecretsToConnector: (connectorId: string, mappings: ops.vault.SecretRef[]) =>
      ops.vault.attachSecretsToConnector(connectorId, mappings),

    /**
     * Inject secrets into a run (DEFERRED - returns NOT_IMPLEMENTED)
     */
    injectSecretsIntoRun: (runId: string, mappings: ops.vault.SecretRef[]) =>
      ops.vault.injectSecretsIntoRun(runId, mappings),

    /**
     * Audit log operations (cursor-based pagination)
     */
    audit: {
      /** List audit events */
      list: (opts?: ops.vault.AuditListOptions) => ops.vault.audit.list(opts),
    },
  },
};

// =============================================================================
// ADVANCED API (for power users)
// =============================================================================

export const advanced = {
  /**
   * Auth operations (low-level)
   */
  auth: {
    /** Set engine auth context directly. */
    setContext: ops.auth.setContext,

    /** Refresh access token. */
    refresh: authClient.refresh,

    /** Subscribe to auth state changes. */
    onAuthChange: authClient.onAuthChange,
  },

  /**
   * Home operations (low-level)
   */
  home: {
    /** Get raw home status (state machine). */
    status: ops.home.status,

    /** Request home grant manually. */
    grant: ops.home.grant,
  },

  /**
   * Paths operations (low-level)
   */
  paths: {
    /** Check if operation is allowed (with details). */
    check: ops.paths.check,

    /** List all path grants. */
    list: ops.paths.list,

    /** Get path info. */
    get: ops.paths.get,

    /** Request path access. */
    request: ops.paths.request,

    /** Remove path grant. */
    remove: ops.paths.remove,
  },

  /**
   * Runtime operations
   */
  runtime: {
    /** Get runtime info. */
    info: ops.runtime.info,
  },

  /**
   * Runner operations (local runner status + task queue stats)
   */
  runner: {
    /** Get local runner status for this desktop instance. */
    status: ops.runner.status,
    /** Get task queue stats from engine API (proxied via Rust). */
    taskStats: ops.runner.taskStats,
  },

  /**
   * Node session operations (Ed25519-based authentication)
   */
  nodeSession: {
    /** Ensure node identity exists (keypair generation). No auth required. */
    ensureIdentity: ops.nodeSession.ensureIdentity,
    /** Bootstrap full node session. Requires user to be logged in. */
    bootstrap: ops.nodeSession.bootstrap,
    /** Get current node session status. */
    status: ops.nodeSession.status,
  },

  /**
   * Node credentials operations (keychain-stored)
   */
  nodeCredentials: {
    /** Set node credentials in keychain. */
    set: ops.nodeCredentials.set,
    /** Get credentials status. */
    status: ops.nodeCredentials.status,
    /** Clear credentials from keychain. */
    clear: ops.nodeCredentials.clear,
  },

  /**
   * Vault operations (low-level)
   */
  vault: {
    /** Vault status */
    status: ops.vault.status,
    /** Vault capabilities */
    capabilities: ops.vault.capabilities,
    /** Secret operations (metadata only) */
    secrets: ops.vault.secrets,
    /** Bundle operations */
    bundles: ops.vault.bundles,
    /** Files operations */
    files: ops.vault.files,
    /** Attach secrets to connector */
    attachSecretsToConnector: ops.vault.attachSecretsToConnector,
    /** Inject secrets into run */
    injectSecretsIntoRun: ops.vault.injectSecretsIntoRun,
    /** Audit operations */
    audit: ops.vault.audit,
  },

  /**
   * Internal backend access
   */
  internal: {
    /** Get current transport mode. */
    mode: () => _internal.getMode(),
  },
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { SetupState, SetupStatus } from './ops/setup';
export type { HomeState, HomeStatus, GrantResult } from './ops/home';
export type {
  PathType,
  PathAccess,
  PathInfo,
  PathCheckResult,
  PathGrantResult,
  PathRequestOptions,
} from './ops/paths';
export type { RuntimeInfo } from './ops/runtime';
export type { RunnerStatus, RunnerLoopState, RunnerTaskStats } from './ops/runner';
export type { AuthContext } from './ops/auth';
export type {
  NodeIdentity,
  EnsureIdentityResult,
  BootstrapOptions,
  BootstrapResult,
  SessionInfo,
  NodeSessionStatus,
} from './ops/nodeSession';
export type {
  SetCredentialsInput,
  SetCredentialsResult,
  CredentialsStatus,
  NodeAuthSession,
} from './ops/nodeCredentials';
export type { UserInfo, AuthTokens } from './auth/types';
export type { TransportMode } from './internal';

// Vault types
export type {
  VaultStatus,
  VaultCapabilities,
  SecretType,
  SecretMeta,
  SecretCreateInput,
  SecretUpdateInput,
  SecretListOptions,
  BundleMeta,
  BundleCreateInput,
  BundleListOptions,
  FileKind,
  FileEntry,
  FileOptions,
  FileListOptions,
  FileDeleteOptions,
  SecretInjection,
  SecretRef,
  AuditAction,
  AuditEvent,
  AuditListOptions,
  AuditListResult,
} from './ops/vault';

// =============================================================================
// ERROR EXPORTS
// =============================================================================

export {
  EkkaError,
  EkkaNotConnectedError,
  EkkaConnectionError,
  EkkaApiError,
} from './errors';

// =============================================================================
// UTILITIES (optional helpers)
// =============================================================================

export {
  formatRelativeTime,
  formatLocalTime,
  formatExpiryInfo,
} from './utils/time';

// =============================================================================
// AUDIT (client-side event logging)
// =============================================================================

export type { AuditEvent as ClientAuditEvent } from './audit/types';
export {
  addAuditEvent,
  getAuditEvents,
  clearAuditEvents,
  subscribeToAuditEvents,
} from './audit/store';
