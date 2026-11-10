import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest, getActiveFarmId } from './api';
import { useAuth } from './auth';

export interface ModuleAccess {
  id: string;
  module_key: string;
  enabled_for_workers: boolean;
  label: string;
  updated_by: string | null;
}

interface ModuleAccessContextType {
  access: Record<string, ModuleAccess>;
  loading: boolean;
  error: boolean;
  isModuleEnabled: (moduleKey: string) => boolean;
  refresh: () => void;
}

const ModuleAccessContext = createContext<ModuleAccessContextType>({
  access: {},
  loading: true,
  error: false,
  isModuleEnabled: () => true,
  refresh: () => {},
});

export function ModuleAccessProvider({ children }: { children: ReactNode }) {
  const { profile, user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<Record<string, ModuleAccess>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    if (!user?.id) {
      setAccess({});
      setError(false);
      setLoading(false);
      return;
    }

    if (profile?.role === 'admin' && !getActiveFarmId()) {
      setAccess({});
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<ModuleAccess[]>('/api/module-access/');
      const map: Record<string, ModuleAccess> = {};
      for (const row of data) map[row.module_key] = row;
      setAccess(map);
      setError(false);
    } catch (err) {
      console.error('Error loading module access:', err);
      setError(true);
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, profile?.role, user?.id]);

  const isModuleEnabled = (moduleKey: string): boolean => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    if (error) return false;
    const entry = access[moduleKey];
    if (!entry) return true;
    return entry.enabled_for_workers;
  };

  const refresh = () => {
    load();
  };

  return (
    <ModuleAccessContext.Provider value={{ access, loading, error, isModuleEnabled, refresh }}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

export function useModuleAccess() {
  return useContext(ModuleAccessContext);
}
