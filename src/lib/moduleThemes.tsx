import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './auth';
import { apiRequest, getActiveFarmId } from './api';
import type { ModuleTheme } from './types';

export type ModuleKey =
  | 'dashboard' | 'animals' | 'milk' | 'vaccines' | 'medications'
  | 'inputs' | 'equipment' | 'crops' | 'fish' | 'activities'
  | 'diseases' | 'reports' | 'users' | 'settings';

const DEFAULT_THEME: ModuleTheme = {
  id: '',
  module_key: '',
  card_radius: '1rem',
  card_padding: '1.5rem',
  card_border_color: '#e2e8f0',
  card_bg_color: '#ffffff',
  card_shadow: 'sm',
  grid_columns: '4',
  grid_gap: '1rem',
  heading_size: '1.5rem',
  heading_color: '#1e293b',
  body_text_size: '0.875rem',
  body_text_color: '#64748b',
  accent_color: '#059669',
  table_header_bg: '#f8fafc',
  table_row_hover_bg: '#f8fafc',
  density: 'normal',
  updated_at: '',
  updated_by: null,
};

interface ModuleThemeContextType {
  themes: Record<string, ModuleTheme>;
  loading: boolean;
  getTheme: (moduleKey: ModuleKey) => ModuleTheme;
  updateTheme: (moduleKey: ModuleKey, theme: Partial<ModuleTheme>) => void;
  refresh: () => void;
}

const ModuleThemeContext = createContext<ModuleThemeContextType>({
  themes: {},
  loading: true,
  getTheme: () => DEFAULT_THEME,
  updateTheme: () => {},
  refresh: () => {},
});

export function ModuleThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [themes, setThemes] = useState<Record<string, ModuleTheme>>({});
  const [loading, setLoading] = useState(true);

  const loadThemes = async () => {
    if (!user?.id) {
      setThemes({});
      setLoading(false);
      return;
    }

    if (profile?.role === 'admin' && !getActiveFarmId()) {
      setThemes({});
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<ModuleTheme[]>('/api/module-themes/');
      const map: Record<string, ModuleTheme> = {};
      for (const row of data) map[row.module_key] = row;
      setThemes(map);
    } catch (error) {
      console.error('Error loading module themes:', error);
      setThemes({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      void loadThemes();
    }
  }, [authLoading, profile?.role, user?.id]);

  const getTheme = (moduleKey: ModuleKey): ModuleTheme => {
    return themes[moduleKey] ?? { ...DEFAULT_THEME, module_key: moduleKey };
  };

  const updateTheme = (moduleKey: ModuleKey, updates: Partial<ModuleTheme>) => {
    setThemes((prev) => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] ?? { ...DEFAULT_THEME, module_key: moduleKey }), ...updates },
    }));
  };

  const refresh = () => {
    loadThemes();
  };

  return (
    <ModuleThemeContext.Provider value={{ themes, loading, getTheme, updateTheme, refresh }}>
      {children}
    </ModuleThemeContext.Provider>
  );
}

export function useModuleThemes() {
  return useContext(ModuleThemeContext);
}

export function useModuleTheme(moduleKey: ModuleKey) {
  const { getTheme } = useModuleThemes();
  return getTheme(moduleKey);
}

export { DEFAULT_THEME };
