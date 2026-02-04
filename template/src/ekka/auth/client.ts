/**
 * Auth API Client
 *
 * Handles authentication requests to the EKKA API.
 * All HTTP proxied through Rust via engine_request.
 */

import { OPS } from '../constants';
import { _internal, makeRequest } from '../internal';
import type {
  LoginResponse,
  RefreshResponse,
  AuthTokens,
  UserInfo,
} from './types';
import {
  setTokens,
  clearTokens,
  getRefreshToken,
  getAccessToken,
  setUser,
  getUser,
  clearUser,
} from './storage';

/**
 * API request error with status code and error details.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Login with email/username and password.
 * Stores tokens and user info on success.
 *
 * @throws ApiRequestError on authentication failure
 */
export async function login(identifier: string, password: string): Promise<LoginResponse> {
  const req = makeRequest(OPS.AUTH_LOGIN, {
    identifier,
    password,
  });

  const engineResponse = await _internal.request(req);

  if (!engineResponse.ok) {
    const error = engineResponse.error;
    throw new ApiRequestError(
      error?.message || 'Login failed',
      error?.status || 401,
      error?.code || 'AUTH_ERROR'
    );
  }

  const response = engineResponse.result as LoginResponse;

  // Store tokens and user
  setTokens({
    access_token: response.access_token,
    refresh_token: response.refresh_token,
  });
  setUser(response.user);

  // Notify listeners
  notifyAuthChange(true);

  return response;
}

/**
 * Refresh the access token using the stored refresh token.
 * Stores new tokens on success.
 *
 * @throws Error if no refresh token available
 * @throws ApiRequestError if refresh fails
 */
export async function refresh(): Promise<AuthTokens> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const req = makeRequest(OPS.AUTH_REFRESH, {
    refresh_token: refreshToken,
    jwt: getAccessToken(), // Include current access token if available
  });

  try {
    const engineResponse = await _internal.request(req);

    if (!engineResponse.ok) {
      const error = engineResponse.error;
      throw new ApiRequestError(
        error?.message || 'Token refresh failed',
        error?.status || 401,
        error?.code || 'AUTH_ERROR'
      );
    }

    const response = engineResponse.result as RefreshResponse;

    // Store new tokens
    setTokens({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    });

    // Notify listeners
    notifyAuthChange(true);

    return {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    };
  } catch (error) {
    // Clear tokens on refresh failure (session expired)
    clearTokens();
    clearUser();
    notifyAuthChange(false);
    throw error;
  }
}

/**
 * Logout the current user.
 * Clears all stored tokens and user info.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  // Attempt to notify server (best effort)
  if (refreshToken) {
    try {
      const req = makeRequest(OPS.AUTH_LOGOUT, {
        refresh_token: refreshToken,
      });
      await _internal.request(req);
    } catch {
      // Ignore server errors during logout
    }
  }

  // Always clear local state
  clearTokens();
  clearUser();
  notifyAuthChange(false);
}

/**
 * Check if user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * Get current user info.
 */
export function getCurrentUser(): UserInfo | null {
  return getUser();
}

// =============================================================================
// AUTH STATE CHANGE LISTENERS
// =============================================================================

type AuthChangeListener = (isAuthenticated: boolean) => void;
const authChangeListeners: Set<AuthChangeListener> = new Set();

/**
 * Subscribe to authentication state changes.
 * Returns an unsubscribe function.
 */
export function onAuthChange(listener: AuthChangeListener): () => void {
  authChangeListeners.add(listener);
  return () => {
    authChangeListeners.delete(listener);
  };
}

/**
 * Notify all listeners of auth state change.
 */
function notifyAuthChange(isAuthenticated: boolean): void {
  authChangeListeners.forEach((listener) => {
    try {
      listener(isAuthenticated);
    } catch {
      // Ignore listener errors
    }
  });
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { UserInfo, AuthTokens } from './types';
