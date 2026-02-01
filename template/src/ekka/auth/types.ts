/**
 * Auth Types
 *
 * Type definitions for authentication system.
 */

// =============================================================================
// REQUEST TYPES
// =============================================================================

export interface LoginRequest {
  identifier: string; // Email or username
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  company?: {
    id: string;
    name: string;
  };
}

export interface LoginResponse {
  user: UserInfo;
  access_token: string;
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export interface LogoutResponse {
  message: string;
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
}
