/**
 * Token & User Storage
 *
 * Memory storage for access token (secure - never persisted)
 * localStorage for refresh token (persistent across sessions)
 * localStorage for user info (persistent across sessions)
 */

import type { AuthTokens, UserInfo } from './types';

// =============================================================================
// STORAGE KEYS
// =============================================================================

const REFRESH_TOKEN_KEY = 'ekka.auth.refresh_token';
const USER_KEY = 'ekka.auth.user';

// =============================================================================
// IN-MEMORY TOKEN STORAGE
// =============================================================================

// Access token stored in memory only (never persisted to disk)
let accessToken: string | null = null;

// =============================================================================
// TOKEN FUNCTIONS
// =============================================================================

/**
 * Store authentication tokens.
 * Access token in memory, refresh token in localStorage.
 */
export function setTokens(tokens: AuthTokens): void {
  accessToken = tokens.access_token;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
}

/**
 * Get the current access token from memory.
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Get the refresh token from localStorage.
 */
export function getRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Clear all tokens.
 */
export function clearTokens(): void {
  accessToken = null;

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/**
 * Check if a refresh token exists in localStorage.
 */
export function hasStoredRefreshToken(): boolean {
  return getRefreshToken() !== null;
}

// =============================================================================
// USER FUNCTIONS
// =============================================================================

/**
 * Store user info in localStorage.
 */
export function setUser(user: UserInfo): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Get user info from localStorage.
 */
export function getUser(): UserInfo | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored) as UserInfo;
  } catch {
    return null;
  }
}

/**
 * Clear user info.
 */
export function clearUser(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(USER_KEY);
  }
}
