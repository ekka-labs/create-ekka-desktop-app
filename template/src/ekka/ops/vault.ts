/**
 * Vault Operations
 *
 * Secrets, bundles, files, and audit operations.
 *
 * ## Security Invariant
 *
 * Secret values are NEVER returned by the API. The API returns metadata only.
 * Values are only accepted in create/update operations as input.
 *
 * ## Scoping
 *
 * - Secrets and Bundles: tenant-scoped (shared across workspaces)
 * - Files: tenant + workspace scoped
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';

// =============================================================================
// Status Types
// =============================================================================

/** Vault status information */
export interface VaultStatus {
  /** Whether the vault is initialized */
  initialized: boolean;
  /** Current tenant ID */
  tenantId?: string;
  /** Available workspace IDs */
  workspaces: string[];
}

/** Vault capabilities */
export interface VaultCapabilities {
  /** Supported features */
  features: string[];
  /** Maximum secret value size in bytes */
  maxSecretSize: number;
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Maximum path depth */
  maxPathDepth: number;
}

// =============================================================================
// Secret Types
// =============================================================================

/** Secret type classification */
export type SecretType =
  | 'PASSWORD'
  | 'API_KEY'
  | 'TOKEN'
  | 'CERTIFICATE'
  | 'SSH_KEY'
  | 'GENERIC_TEXT';

/** Secret metadata - NEVER contains the actual value */
export interface SecretMeta {
  id: string;
  name: string;
  secretType: SecretType;
  tags: string[];
  bundleId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating a secret (value accepted here only) */
export interface SecretCreateInput {
  name: string;
  value: string;
  secretType?: SecretType;
  tags?: string[];
  bundleId?: string;
}

/** Input for updating a secret (value accepted here only) */
export interface SecretUpdateInput {
  name?: string;
  value?: string;
  secretType?: SecretType;
  tags?: string[];
  bundleId?: string;
}

/** Options for listing secrets */
export interface SecretListOptions {
  secretType?: SecretType;
  tag?: string;
  bundleId?: string;
}

// =============================================================================
// Bundle Types
// =============================================================================

/** Bundle metadata */
export interface BundleMeta {
  id: string;
  name: string;
  description?: string;
  secretIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Input for creating a bundle */
export interface BundleCreateInput {
  name: string;
  description?: string;
}

/** Options for listing bundles */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Reserved for future filtering options
export interface BundleListOptions {}

// =============================================================================
// File Types (NEW)
// =============================================================================

/** File entry kind */
export type FileKind = 'FILE' | 'DIR';

/** File entry metadata */
export interface FileEntry {
  /** Relative path from workspace root */
  path: string;
  /** Filename only */
  name: string;
  /** File or Dir */
  kind: FileKind;
  /** Size in bytes (for files only) */
  sizeBytes?: number;
  /** Last modified timestamp */
  modifiedAt?: string;
}

/** Options for file operations */
export interface FileOptions {
  /** Workspace ID (defaults to "default") */
  workspaceId?: string;
}

/** Options for listing files */
export interface FileListOptions {
  /** Workspace ID (defaults to "default") */
  workspaceId?: string;
  /** Whether to list recursively */
  recursive?: boolean;
}

/** Options for deleting files/directories */
export interface FileDeleteOptions {
  /** Workspace ID (defaults to "default") */
  workspaceId?: string;
  /** Whether to delete recursively (for directories) */
  recursive?: boolean;
}

// =============================================================================
// SecretRef Types (Non-Revealing Usage)
// =============================================================================

/** How to inject a secret value */
export type SecretInjection =
  | { type: 'ENV_VAR'; name: string }
  | { type: 'FILE'; path: string }
  | { type: 'HEADER'; name: string };

/** Reference to a secret for non-revealing usage */
export interface SecretRef {
  /** Secret ID (preferred) or name */
  secretId?: string;
  /** Secret name (for lookup if id not provided) */
  name?: string;
  /** How to inject the secret */
  injectAs: SecretInjection;
}

// =============================================================================
// Audit Types
// =============================================================================

/** Audit event action */
export type AuditAction =
  // Secret events
  | 'secret.created'
  | 'secret.updated'
  | 'secret.deleted'
  | 'secret.accessed'
  // Bundle events
  | 'bundle.created'
  | 'bundle.updated'
  | 'bundle.deleted'
  | 'bundle.secret_added'
  | 'bundle.secret_removed'
  // File events
  | 'file.written'
  | 'file.read'
  | 'file.deleted'
  | 'file.mkdir'
  | 'file.moved'
  // Legacy
  | 'secrets_injected';

/** Audit event */
export interface AuditEvent {
  eventId: string;
  action: AuditAction;
  timestamp: string;
  secretId?: string;
  secretName?: string;
  bundleId?: string;
  path?: string;
  actorId?: string;
}

/** Options for listing audit events (cursor-based pagination) */
export interface AuditListOptions {
  /** Maximum number of events to return (default 50, max 100) */
  limit?: number;
  /** Opaque cursor for pagination */
  cursor?: string;
  /** Filter by action (e.g., "secret.created", "file.written") */
  action?: string;
  /** Text search across event data */
  search?: string;
  /** Filter by secret ID */
  secretId?: string;
  /** Filter by bundle ID */
  bundleId?: string;
  /** Filter by path prefix */
  pathPrefix?: string;
}

/** Audit list result with cursor-based pagination */
export interface AuditListResult {
  events: AuditEvent[];
  nextCursor?: string;
  hasMore: boolean;
}

// =============================================================================
// Internal helper
// =============================================================================

async function doRequest<T>(op: string, payload: object): Promise<T> {
  const req = makeRequest(op, payload);
  const response = await _internal.request(req);
  if (!response.ok) {
    throw new Error(response.error?.message || `Operation ${op} failed`);
  }
  return response.result as T;
}

// =============================================================================
// Status Operations
// =============================================================================

/** Get vault status */
export async function status(): Promise<VaultStatus> {
  return doRequest<VaultStatus>(OPS.VAULT_STATUS, {});
}

/** Get vault capabilities */
export async function capabilities(): Promise<VaultCapabilities> {
  return doRequest<VaultCapabilities>(OPS.VAULT_CAPABILITIES, {});
}

// =============================================================================
// Secrets Operations
// =============================================================================

export const secrets = {
  /** List all secrets (metadata only, NO values) */
  async list(opts?: SecretListOptions): Promise<SecretMeta[]> {
    const result = await doRequest<{ secrets: SecretMeta[] }>(OPS.VAULT_SECRETS_LIST, { opts });
    return result.secrets;
  },

  /** Get a secret by ID (metadata only, NO value) */
  async get(id: string): Promise<SecretMeta> {
    return doRequest<SecretMeta>(OPS.VAULT_SECRETS_GET, { id });
  },

  /** Create a new secret (value accepted here only) */
  async create(input: SecretCreateInput): Promise<SecretMeta> {
    return doRequest<SecretMeta>(OPS.VAULT_SECRETS_CREATE, input);
  },

  /** Update a secret (value accepted here only) */
  async update(id: string, input: SecretUpdateInput): Promise<SecretMeta> {
    return doRequest<SecretMeta>(OPS.VAULT_SECRETS_UPDATE, { id, input });
  },

  /** Delete a secret */
  async delete(id: string): Promise<boolean> {
    const result = await doRequest<{ deleted: boolean }>(OPS.VAULT_SECRETS_DELETE, { id });
    return result.deleted;
  },

  /** Upsert a secret (create or update by name) */
  async upsert(input: SecretCreateInput): Promise<SecretMeta> {
    return doRequest<SecretMeta>(OPS.VAULT_SECRETS_UPSERT, input);
  },
};

// =============================================================================
// Bundles Operations
// =============================================================================

export const bundles = {
  /** List all bundles */
  async list(opts?: BundleListOptions): Promise<BundleMeta[]> {
    const result = await doRequest<{ bundles: BundleMeta[] }>(OPS.VAULT_BUNDLES_LIST, { opts });
    return result.bundles;
  },

  /** Get a bundle by ID */
  async get(id: string): Promise<BundleMeta> {
    return doRequest<BundleMeta>(OPS.VAULT_BUNDLES_GET, { id });
  },

  /** Create a new bundle */
  async create(input: BundleCreateInput): Promise<BundleMeta> {
    return doRequest<BundleMeta>(OPS.VAULT_BUNDLES_CREATE, input);
  },

  /** Rename a bundle */
  async rename(id: string, name: string): Promise<BundleMeta> {
    return doRequest<BundleMeta>(OPS.VAULT_BUNDLES_RENAME, { id, name });
  },

  /** Delete a bundle */
  async delete(id: string): Promise<boolean> {
    const result = await doRequest<{ deleted: boolean }>(OPS.VAULT_BUNDLES_DELETE, { id });
    return result.deleted;
  },

  /** List secrets in a bundle */
  async listSecrets(bundleId: string, opts?: SecretListOptions): Promise<SecretMeta[]> {
    const result = await doRequest<{ secrets: SecretMeta[] }>(OPS.VAULT_BUNDLES_LIST_SECRETS, { bundleId, opts });
    return result.secrets;
  },

  /** Add a secret to a bundle */
  async addSecret(bundleId: string, secretId: string): Promise<BundleMeta> {
    return doRequest<BundleMeta>(OPS.VAULT_BUNDLES_ADD_SECRET, { bundleId, secretId });
  },

  /** Remove a secret from a bundle */
  async removeSecret(bundleId: string, secretId: string): Promise<BundleMeta> {
    return doRequest<BundleMeta>(OPS.VAULT_BUNDLES_REMOVE_SECRET, { bundleId, secretId });
  },
};

// =============================================================================
// Files Operations (NEW)
// =============================================================================

export const files = {
  /** Write text content to a file */
  async writeText(path: string, content: string, opts?: FileOptions): Promise<void> {
    await doRequest<{ written: boolean }>(OPS.VAULT_FILES_WRITE_TEXT, { path, content, opts });
  },

  /** Write binary content to a file (content as base64) */
  async writeBytes(path: string, contentBytes: string, opts?: FileOptions): Promise<void> {
    await doRequest<{ written: boolean }>(OPS.VAULT_FILES_WRITE_BYTES, { path, contentBytes, opts });
  },

  /** Read text content from a file */
  async readText(path: string, opts?: FileOptions): Promise<string> {
    const result = await doRequest<{ content: string }>(OPS.VAULT_FILES_READ_TEXT, { path, opts });
    return result.content;
  },

  /** Read binary content from a file (returns base64) */
  async readBytes(path: string, opts?: FileOptions): Promise<string> {
    const result = await doRequest<{ contentBytes: string }>(OPS.VAULT_FILES_READ_BYTES, { path, opts });
    return result.contentBytes;
  },

  /** List files and directories */
  async list(dir: string, opts?: FileListOptions): Promise<FileEntry[]> {
    const result = await doRequest<{ entries: FileEntry[] }>(OPS.VAULT_FILES_LIST, { dir, opts });
    return result.entries;
  },

  /** Check if a file or directory exists */
  async exists(path: string, opts?: FileOptions): Promise<boolean> {
    const result = await doRequest<{ exists: boolean }>(OPS.VAULT_FILES_EXISTS, { path, opts });
    return result.exists;
  },

  /** Delete a file or directory */
  async delete(path: string, opts?: FileDeleteOptions): Promise<boolean> {
    const result = await doRequest<{ deleted: boolean }>(OPS.VAULT_FILES_DELETE, { path, opts });
    return result.deleted;
  },

  /** Create a directory */
  async mkdir(path: string, opts?: FileOptions): Promise<void> {
    await doRequest<{ created: boolean }>(OPS.VAULT_FILES_MKDIR, { path, opts });
  },

  /** Move a file or directory */
  async move(from: string, to: string, opts?: FileOptions): Promise<void> {
    await doRequest<{ moved: boolean }>(OPS.VAULT_FILES_MOVE, { from, to, opts });
  },
};

// =============================================================================
// Injection Operations (DEFERRED - return NOT_IMPLEMENTED)
// =============================================================================

/**
 * Attach secrets to a connector configuration (DEFERRED)
 * @returns Promise that resolves on success
 * @throws Error with code NOT_IMPLEMENTED
 */
export async function attachSecretsToConnector(
  connectorId: string,
  mappings: SecretRef[]
): Promise<void> {
  await doRequest<{ attached: boolean }>(OPS.VAULT_ATTACH_SECRETS_TO_CONNECTOR, {
    connectorId,
    mappings,
  });
}

/**
 * Inject secrets into a run (DEFERRED)
 * Note: This returns success/failure only, NOT the injected values
 * @returns Promise that resolves on success
 * @throws Error with code NOT_IMPLEMENTED
 */
export async function injectSecretsIntoRun(
  runId: string,
  mappings: SecretRef[]
): Promise<void> {
  await doRequest<{ injected: boolean }>(OPS.VAULT_INJECT_SECRETS_INTO_RUN, {
    runId,
    mappings,
  });
}

// =============================================================================
// Audit Operations
// =============================================================================

export const audit = {
  /** List audit events with cursor-based pagination */
  async list(opts?: AuditListOptions): Promise<AuditListResult> {
    return doRequest<AuditListResult>(OPS.VAULT_AUDIT_LIST, { opts });
  },
};
