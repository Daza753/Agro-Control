import { useSettings } from '../lib/settings';

export function DynamicTheme() {
  const { settings } = useSettings();

  if (!settings) return null;

  return (
    <style>{`
      :root {
        --primary: ${settings.primary_color};
        --primary-hover: color-mix(in srgb, ${settings.primary_color} 85%, white);
        --secondary: ${settings.secondary_color};
        --accent: ${settings.accent_color};
      }
      .theme-primary {
        background-color: ${settings.primary_color};
      }
      .theme-primary-text {
        color: ${settings.primary_color};
      }
      .theme-primary-border {
        border-color: ${settings.primary_color};
      }
      .theme-secondary {
        background-color: ${settings.secondary_color};
      }
    `}</style>
  );
}
