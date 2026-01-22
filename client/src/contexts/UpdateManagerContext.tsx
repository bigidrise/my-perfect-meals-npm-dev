import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { updateApp } from '@/lib/updateApp';

interface UpdateManagerState {
  updateAvailable: boolean;
  dismissedThisSession: boolean;
  applyUpdate: () => void;
  dismissUpdate: () => void;
}

const UpdateManagerContext = createContext<UpdateManagerState | null>(null);

export function UpdateManagerProvider({ children }: { children: ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      console.log('📢 [MPM Update] Update available event received');
      setUpdateAvailable(true);
    };

    window.addEventListener('mpm:update-available', handleUpdateAvailable);

    const pendingUpdate = localStorage.getItem('mpmUpdatePending');
    if (pendingUpdate === '1') {
      console.log('🔄 [MPM Update] Pending update from previous session - applying on cold start');
      localStorage.removeItem('mpmUpdatePending');
      updateApp();
    }

    return () => {
      window.removeEventListener('mpm:update-available', handleUpdateAvailable);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    console.log('🔄 [MPM Update] User clicked Update Now');
    updateApp();
  }, []);

  const dismissUpdate = useCallback(() => {
    console.log('📝 [MPM Update] User dismissed update for this session');
    setDismissedThisSession(true);
    localStorage.setItem('mpmUpdatePending', '1');
  }, []);

  return (
    <UpdateManagerContext.Provider
      value={{
        updateAvailable,
        dismissedThisSession,
        applyUpdate,
        dismissUpdate,
      }}
    >
      {children}
    </UpdateManagerContext.Provider>
  );
}

export function useUpdateManager() {
  const context = useContext(UpdateManagerContext);
  if (!context) {
    throw new Error('useUpdateManager must be used within UpdateManagerProvider');
  }
  return context;
}
