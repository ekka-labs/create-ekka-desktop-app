/**
 * Auth Module Exports
 *
 * Public API for authentication.
 */

// Types
export type {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  AuthTokens,
  AuthState,
  UserInfo,
} from './types';

// Client functions
export {
  login,
  logout,
  refresh,
  isAuthenticated,
  getCurrentUser,
  onAuthChange,
  ApiRequestError,
} from './client';

// Storage helpers
export { getAccessToken, hasStoredRefreshToken } from './storage';
