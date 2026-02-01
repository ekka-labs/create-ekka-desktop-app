/**
 * EKKA Demo App
 *
 * Flow:
 * 1. Connect to engine
 * 2. Check auth - if not logged in, show LoginPage
 * 3. After login, check home.status
 * 4. If not HOME_GRANTED, show HomeSetupPage
 * 5. Show main app when HOME_GRANTED
 */

import { useState, useEffect, type ReactElement, type CSSProperties } from 'react';
import { ekka, advanced, EkkaError, addAuditEvent, type HomeStatus } from '../ekka';
import { Shell } from './layout/Shell';
import { type Page } from './layout/Sidebar';
import { SystemPage } from './pages/SystemPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { PathPermissionsPage } from './pages/PathPermissionsPage';
import { VaultPage } from './pages/VaultPage';
import { DocGenPage } from './pages/DocGenPage';
import { RunnerPage } from './pages/RunnerPage';
import { LoginPage } from './pages/LoginPage';
import { HomeSetupPage } from './pages/HomeSetupPage';

type AppState = 'loading' | 'login' | 'home-setup' | 'ready';

interface DemoState {
  appState: AppState;
  homeStatus: HomeStatus | null;
  connected: boolean;
  error: string | null;
}

export function DemoApp(): ReactElement {
  const [selectedPage, setSelectedPage] = useState<Page>('path-permissions');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [state, setState] = useState<DemoState>({
    appState: 'loading',
    homeStatus: null,
    connected: false,
    error: null,
  });

  useEffect(() => {
    void initializeApp();
  }, []);

  async function initializeApp(): Promise<void> {
    try {
      await ekka.connect();
      setState((s) => ({ ...s, connected: true }));

      addAuditEvent({
        type: 'connection.established',
        description: 'Connected to EKKA backend',
        technical: { mode: advanced.internal.mode() },
      });

      if (!ekka.auth.isLoggedIn()) {
        setState((s) => ({ ...s, appState: 'login' }));
        return;
      }

      const user = ekka.auth.user();
      if (user) {
        const tenantId = user.company?.id || 'default';
        await advanced.auth.setContext({ tenantId, sub: user.id, jwt: '' });
      }

      await checkHomeStatus();
    } catch (err: unknown) {
      const message = err instanceof EkkaError ? err.message : 'Connection failed';
      setState((s) => ({ ...s, error: message, appState: 'login' }));

      addAuditEvent({
        type: 'connection.failed',
        description: 'Failed to connect to EKKA backend',
        technical: { error: message },
      });
    }
  }

  async function checkHomeStatus(): Promise<void> {
    try {
      const status = await advanced.home.status();
      setState((s) => ({ ...s, homeStatus: status }));

      if (status.state === 'HOME_GRANTED') {
        setState((s) => ({ ...s, appState: 'ready' }));
      } else if (status.state === 'AUTHENTICATED_NO_HOME_GRANT') {
        setState((s) => ({ ...s, appState: 'home-setup' }));
      } else {
        setState((s) => ({ ...s, appState: 'login' }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check home status';
      setState((s) => ({ ...s, error: message }));
    }
  }

  async function handleLoginSuccess(): Promise<void> {
    await checkHomeStatus();
  }

  function handleHomeGranted(): void {
    setState((s) => ({ ...s, appState: 'ready' }));
  }

  // Loading
  if (state.appState === 'loading') {
    const style: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: darkMode ? '#1c1c1e' : '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      color: darkMode ? '#98989d' : '#86868b',
      fontSize: '14px',
    };
    return <div style={style}>Connecting...</div>;
  }

  // Login
  if (state.appState === 'login') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} darkMode={darkMode} />;
  }

  // Home setup
  if (state.appState === 'home-setup' && state.homeStatus) {
    return (
      <HomeSetupPage
        homeStatus={state.homeStatus}
        onGranted={handleHomeGranted}
        darkMode={darkMode}
      />
    );
  }

  // Main app
  const errorStyle: CSSProperties = {
    marginBottom: '20px',
    padding: '12px 14px',
    background: darkMode ? '#3c1618' : '#fef2f2',
    border: `1px solid ${darkMode ? '#7f1d1d' : '#fecaca'}`,
    borderRadius: '6px',
    fontSize: '13px',
    color: darkMode ? '#fca5a5' : '#991b1b',
  };

  return (
    <Shell
      selectedPage={selectedPage}
      onNavigate={setSelectedPage}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((prev) => !prev)}
    >
      {state.error && <div style={errorStyle}>{state.error}</div>}
      {selectedPage === 'path-permissions' && <PathPermissionsPage darkMode={darkMode} />}
      {selectedPage === 'vault' && <VaultPage darkMode={darkMode} />}
      {selectedPage === 'doc-gen' && <DocGenPage darkMode={darkMode} />}
      {selectedPage === 'runner' && <RunnerPage darkMode={darkMode} />}
      {selectedPage === 'audit-log' && <AuditLogPage darkMode={darkMode} />}
      {selectedPage === 'system' && <SystemPage darkMode={darkMode} />}
    </Shell>
  );
}
