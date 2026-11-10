import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './auth';
import { apiRequest, getActiveFarmId } from './api';
import type { FarmSettings } from './types';

export const BACKGROUND_MODE_STORAGE_KEY = 'finca-control-background-mode';

export function getStoredBackgroundMode(): FarmSettings['background_mode'] {
  if (typeof window === 'undefined') return 'light';

  const storedMode = window.localStorage.getItem(BACKGROUND_MODE_STORAGE_KEY);
  return storedMode === 'dark' ? 'dark' : 'light';
}

interface SettingsContextType {
  settings: FarmSettings | null;
  loading: boolean;
  updateSettings: (newSettings: FarmSettings) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  loading: true,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FarmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setSettings(null);
      setLoading(false);
      return;
    }

    if (profile?.role === 'admin' && !getActiveFarmId()) {
      setSettings(null);
      setLoading(false);
      return;
    }

    void loadSettings();
  }, [authLoading, profile?.role, user?.id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const rows = await apiRequest<FarmSettings[]>('/api/farm-settings/');
      const farmSettings = rows[0];
      setSettings(farmSettings ? {
        ...farmSettings,
        background_mode: farmSettings.background_mode ?? getStoredBackgroundMode(),
      } : null);
    } catch (error) {
      console.error('Error loading farm settings:', error);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = (newSettings: FarmSettings) => {
    setSettings(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
