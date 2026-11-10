import { ReactNode } from 'react';
import { DEFAULT_THEME, useModuleTheme, ModuleKey } from '../lib/moduleThemes';
import { useSettings } from '../lib/settings';

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
};

const DENSITY_PADDING: Record<string, string> = {
  compact: '0.75rem',
  normal: '1.5rem',
  comfortable: '2rem',
};

const DENSITY_GAP: Record<string, string> = {
  compact: '0.5rem',
  normal: '1rem',
  comfortable: '1.5rem',
};

interface ThemeScopeProps {
  moduleKey: ModuleKey;
  children: ReactNode;
}

type ThemeStyle = React.CSSProperties & {
  [key: `--mt-${string}`]: string | number;
};

export function ThemeScope({ moduleKey, children }: ThemeScopeProps) {
  const theme = useModuleTheme(moduleKey);
  const { settings } = useSettings();
  const isDark = settings?.background_mode === 'dark';

  const padding = DENSITY_PADDING[theme.density] ?? theme.card_padding;
  const gap = DENSITY_GAP[theme.density] ?? theme.grid_gap;
  const shadow = SHADOW_MAP[theme.card_shadow] ?? SHADOW_MAP.sm;
  const cardBackground = isDark && theme.card_bg_color === DEFAULT_THEME.card_bg_color
    ? '#1e293b'
    : theme.card_bg_color;
  const cardBorder = isDark && theme.card_border_color === DEFAULT_THEME.card_border_color
    ? '#334155'
    : theme.card_border_color;
  const headingColor = isDark && theme.heading_color === DEFAULT_THEME.heading_color
    ? '#f1f5f9'
    : theme.heading_color;
  const textColor = isDark && theme.body_text_color === DEFAULT_THEME.body_text_color
    ? '#cbd5e1'
    : theme.body_text_color;
  const tableHeaderBackground = isDark && theme.table_header_bg === DEFAULT_THEME.table_header_bg
    ? '#0f172a'
    : theme.table_header_bg;
  const tableHoverBackground = isDark && theme.table_row_hover_bg === DEFAULT_THEME.table_row_hover_bg
    ? '#334155'
    : theme.table_row_hover_bg;

  const styleVars: ThemeStyle = {
    '--mt-card-radius': theme.card_radius,
    '--mt-card-padding': padding,
    '--mt-card-border': cardBorder,
    '--mt-card-bg': cardBackground,
    '--mt-card-shadow': shadow,
    '--mt-grid-columns': theme.grid_columns,
    '--mt-grid-gap': gap,
    '--mt-heading-size': theme.heading_size,
    '--mt-heading-color': headingColor,
    '--mt-text-size': theme.body_text_size,
    '--mt-text-color': textColor,
    '--mt-accent': theme.accent_color,
    '--mt-table-header-bg': tableHeaderBackground,
    '--mt-table-hover-bg': tableHoverBackground,
  };

  return <div style={styleVars} className="mt-scope">{children}</div>;
}
