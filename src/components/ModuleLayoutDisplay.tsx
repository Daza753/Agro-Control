import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import {
  Activity, BarChart3, CalendarDays, CheckCircle2, CircleDot,
  FileText, Filter, Image as ImageIcon, LayoutGrid, List,
  MapPin, MousePointer2, Table2, Type,
} from 'lucide-react';
import { DEFAULT_THEME } from '../lib/moduleThemes';
import { ensureReadableTextColor } from '../lib/colors';
import { getModuleLayout } from '../lib/moduleLayout';
import type { ModuleLayoutItem, ModuleTheme, ModuleWidgetType } from '../lib/types';

const WIDGET_ICONS: Record<ModuleWidgetType, typeof LayoutGrid> = {
  'module-content': LayoutGrid,
  metric: CircleDot,
  chart: BarChart3,
  table: Table2,
  calendar: CalendarDays,
  list: List,
  status: CheckCircle2,
  filters: Filter,
  heading: Type,
  image: ImageIcon,
  summary: FileText,
  activity: Activity,
  map: MapPin,
  shortcut: MousePointer2,
  form: FileText,
};

interface ModuleLayoutDisplayProps {
  layoutConfig?: ModuleTheme['layout_config'];
  theme: ModuleTheme;
  isDark: boolean;
  logoUrl?: string | null;
  content: ReactNode;
  selectedItemId?: string;
  onSelectItem?: (id: string) => void;
  onItemDragStart?: (id: string) => void;
  onItemDrop?: (id: string) => void;
  onItemDragEnd?: () => void;
}

function WidgetDecoration({ item, logoUrl }: { item: ModuleLayoutItem; logoUrl?: string | null }) {
  if (item.type === 'image' && logoUrl) {
    return <img src={logoUrl} alt="Logo de la finca" className="mt-layout-logo" />;
  }
  if (item.type === 'chart') {
    return (
      <div className="mt-layout-chart" aria-hidden="true">
        {[38, 68, 50, 82, 58].map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
    );
  }
  if (item.type === 'table') {
    return <div className="mt-layout-table-mark" aria-hidden="true"><i /><i /><i /></div>;
  }
  if (item.type === 'calendar') {
    return <div className="mt-layout-calendar-mark" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>;
  }
  if (item.type === 'list' || item.type === 'activity') {
    return <div className="mt-layout-list-mark" aria-hidden="true"><i /><i /><i /></div>;
  }
  if (item.type === 'form') {
    return (
      <div className="mt-layout-form-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    );
  }
  if (item.type === 'map') {
    return <div className="mt-layout-map-mark" aria-hidden="true"><MapPin size={22} /></div>;
  }
  if (item.type === 'metric') {
    return <div className="mt-layout-metric-mark" aria-hidden="true"><i /><i /></div>;
  }
  if (item.type === 'filters') {
    return <div className="mt-layout-filter-mark" aria-hidden="true"><i /><i /><i /></div>;
  }
  if (item.type === 'status') {
    return <span className="mt-layout-status-mark" aria-hidden="true">Muestra</span>;
  }
  if (item.type === 'shortcut') {
    return <span className="mt-layout-shortcut-mark" aria-hidden="true">Acceso visual</span>;
  }
  return null;
}

function LayoutWidget({
  item,
  theme,
  isDark,
  logoUrl,
}: {
  item: ModuleLayoutItem;
  theme: ModuleTheme;
  isDark: boolean;
  logoUrl?: string | null;
}) {
  const defaultBackground = isDark && theme.card_bg_color === DEFAULT_THEME.card_bg_color
    ? '#1e293b'
    : theme.card_bg_color;
  const defaultHeading = isDark && theme.heading_color === DEFAULT_THEME.heading_color
    ? '#f1f5f9'
    : theme.heading_color;
  const defaultText = isDark && theme.body_text_color === DEFAULT_THEME.body_text_color
    ? '#cbd5e1'
    : theme.body_text_color;
  const background = item.background_color || defaultBackground;
  const headingColor = ensureReadableTextColor(item.heading_color || defaultHeading, background);
  const textColor = ensureReadableTextColor(item.text_color || defaultText, background);
  const Icon = WIDGET_ICONS[item.type];
  const minHeight = item.height === 'compact' ? '6rem' : item.height === 'tall' ? '14rem' : '9rem';

  return (
    <article
      className="mt-layout-widget"
      style={{
        backgroundColor: background,
        borderColor: isDark && theme.card_border_color === DEFAULT_THEME.card_border_color
          ? '#334155'
          : theme.card_border_color,
        borderRadius: item.border_radius,
        fontFamily: item.font_family,
        minHeight,
      }}
    >
      <header className="mt-layout-widget-heading">
        <span className="mt-layout-widget-icon" style={{ color: ensureReadableTextColor(theme.accent_color, background) }}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <h3 style={{ color: headingColor, fontSize: `${item.heading_size}px` }}>{item.title}</h3>
      </header>
      <WidgetDecoration item={item} logoUrl={logoUrl} />
      <p className="mt-layout-widget-body" style={{ color: textColor, fontSize: `${item.body_size}px` }}>
        {item.body}
      </p>
      <p className="mt-layout-widget-note" style={{ color: textColor }}>
        Bloque visual; no crea ni modifica registros.
      </p>
    </article>
  );
}

export function ModuleLayoutDisplay({
  layoutConfig,
  theme,
  isDark,
  logoUrl,
  content,
  selectedItemId,
  onSelectItem,
  onItemDragStart,
  onItemDrop,
  onItemDragEnd,
}: ModuleLayoutDisplayProps) {
  const items = getModuleLayout(layoutConfig).items;
  const interactive = Boolean(onSelectItem || onItemDragStart || onItemDrop);

  const startDragging = (event: DragEvent<HTMLDivElement>, id: string) => {
    if (!onItemDragStart) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    onItemDragStart(id);
  };

  const dropItem = (event: DragEvent<HTMLDivElement>, id: string) => {
    if (!onItemDrop) return;
    event.preventDefault();
    event.stopPropagation();
    onItemDrop(id);
  };

  const selectItem = (id: string) => {
    if (onSelectItem) onSelectItem(id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectItem(id);
    }
  };

  return (
    <div className="mt-layout-grid">
      {items.map((item) => {
        const isContent = item.type === 'module-content';
        const isSelected = selectedItemId === item.id;
        return (
          <div
            key={item.id}
            className={`mt-layout-item${interactive && isSelected ? ' mt-layout-item-selected' : ''}`}
            style={{ gridColumn: `span ${isContent ? 12 : item.width}` }}
            draggable={Boolean(onItemDragStart)}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'group' : undefined}
            aria-label={interactive ? `Seleccionar ${item.title}; arrastrar para mover` : undefined}
            onClick={() => selectItem(item.id)}
            onKeyDown={(event) => handleKeyDown(event, item.id)}
            onDragStart={(event) => startDragging(event, item.id)}
            onDragEnd={onItemDragEnd}
            onDragOver={(event) => onItemDrop && event.preventDefault()}
            onDrop={(event) => dropItem(event, item.id)}
          >
            {isContent
              ? content
              : <LayoutWidget item={item} theme={theme} isDark={isDark} logoUrl={logoUrl} />}
          </div>
        );
      })}
    </div>
  );
}
