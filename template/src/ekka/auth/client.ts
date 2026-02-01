/**
 * Auth API Client
 *
 * Handles authentication requests to the EKKA API.
 * Uses security envelope headers via the http module.
 */

import { apiRequest, ApiRequestError } from '../api/http';
import { AUTH_ENDPOINTS } from '../config';
import type {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  LogoutRequest,
  LogoutResponse,
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
  const body: LoginRequest = { identifier, password };

  const response = await apiRequest<LoginResponse>(
    AUTH_ENDPOINTS.login,
    {
      method: 'POST',
      module: 'auth',
      action: 'login',
      body,
    }
  );

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

  const body: RefreshRequest = { refresh_token: refreshToken };

  try {
    const response = await apiRequest<RefreshResponse>(
      AUTH_ENDPOINTS.refresh,
      {
        method: 'POST',
        module: 'auth',
        action: 'refresh_token',
        body,
      },
      getAccessToken() // Include current access token if available
    );

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
      const body: LogoutRequest = { refresh_token: refreshToken };
      await apiRequest<LogoutResponse>(
        AUTH_ENDPOINTS.logout,
        {
          method: 'POST',
          module: 'auth',
          action: 'logout',
          body,
        }
      );
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

export { ApiRequestError };
export type { UserInfo, AuthTokens } from './types';
