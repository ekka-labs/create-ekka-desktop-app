/**
 * EKKA Configuration
 *
 * API configuration and client identity constants.
 */

// =============================================================================
// API CONFIGURATION
// =============================================================================

const getApiUrl = (): string => {
  if (import.meta.env.PROD) return 'https://api.ekka.ai';
  if (import.meta.env.VITE_EKKA_API_URL) return import.meta.env.VITE_EKKA_API_URL;
  return 'https://api.ekka.ai';
};

/** API base URL */
export const API_BASE_URL = getApiUrl();

// =============================================================================
// ENGINE CONFIGURATION
// =============================================================================

const getEngineUrl = (): string => {
  if (import.meta.env.VITE_EKKA_ENGINE_URL) return import.meta.env.VITE_EKKA_ENGINE_URL;
  return 'http://localhost:3200'; // Default local engine port
};

/** Engine base URL for workflow runs */
export const ENGINE_BASE_URL = getEngineUrl();

// =============================================================================
// CLIENT IDENTITY (Security Envelope)
// =============================================================================

export const CLIENT_TYPE = 'desktop';
export const CLIENT_VERSION = '0.2.0';

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

export const AUTH_ENDPOINTS = {
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
} as const;
