/**
 * Pre-Login Setup Wizard
 *
 * Single-step setup flow: Connect Node (node_id + node_secret)
 *
 * This runs BEFORE login - no user auth required.
 * Home folder grant is handled POST-login via HomeSetupPage.
 */

import { useCallback } from 'react';
import type { SetupStatus } from '../../ekka';
import { NodeCredentialsOnboarding } from './NodeCredentialsOnboarding';

interface SetupWizardProps {
  /** Initial setup status */
  initialStatus: SetupStatus;
  /** Called when setup is complete */
  onComplete: () => void;
  /** Dark mode */
  darkMode?: boolean;
}

export function SetupWizard({
  onComplete,
  darkMode = false,
}: SetupWizardProps) {
  // Handle node credentials complete
  const handleNodeComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: darkMode ? '#1c1c1e' : '#f5f5f7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
    }}>
      <NodeCredentialsOnboarding onComplete={handleNodeComplete} embedded />
    </div>
  );
}

export default SetupWizard;
