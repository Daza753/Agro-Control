import type { ModuleLayoutConfig, ModuleLayoutItem, ModuleWidgetType } from './types';

export const MODULE_WIDGETS: {
  type: Exclude<ModuleWidgetType, 'module-content'>;
  label: string;
  description: string;
}[] = [
  { type: 'metric', label: 'Indicador', description: 'Tarjeta visual para destacar una cifra.' },
  { type: 'chart', label: 'Gráfico', description: 'Bloque ilustrativo de gráfico, sin datos conectados.' },
  { type: 'table', label: 'Tabla', description: 'Estructura visual para organizar texto.' },
  { type: 'calendar', label: 'Calendario', description: 'Panel visual para fechas y recordatorios.' },
  { type: 'list', label: 'Lista', description: 'Lista visual de elementos escritos por ti.' },
  { type: 'status', label: 'Estado', description: 'Etiqueta visual para destacar un estado.' },
  { type: 'filters', label: 'Filtros', description: 'Fila decorativa de opciones; no filtra registros.' },
  { type: 'heading', label: 'Título', description: 'Encabezado para separar secciones.' },
  { type: 'image', label: 'Logo', description: 'Bloque de presentación del logo de la finca.' },
  { type: 'summary', label: 'Resumen', description: 'Tarjeta para texto descriptivo.' },
  { type: 'activity', label: 'Actividad', description: 'Panel de presentación para notas.' },
  { type: 'map', label: 'Mapa', description: 'Espacio visual de ubicación, sin geolocalización.' },
  { type: 'shortcut', label: 'Acceso visual', description: 'Botón de muestra, sin acción sobre los datos.' },
  { type: 'form', label: 'Formulario visual', description: 'Maqueta de formulario; no crea ni modifica registros.' },
];

export function createModuleContentItem(): ModuleLayoutItem {
  return {
    id: 'module-content',
    type: 'module-content',
    title: 'Contenido funcional del módulo',
    body: '',
    width: 12,
    height: 'normal',
    background_color: '',
    heading_color: '',
    text_color: '',
    font_family: 'Inter',
    heading_size: 18,
    body_size: 14,
    border_radius: '1rem',
  };
}

export function createDefaultModuleLayout(): ModuleLayoutConfig {
  return { version: 1, items: [createModuleContentItem()] };
}

export function getModuleLayout(value?: ModuleLayoutConfig | null): ModuleLayoutConfig {
  if (!value || value.version !== 1 || !Array.isArray(value.items) || value.items.length === 0) {
    return createDefaultModuleLayout();
  }

  const items = value.items.filter((item) => item && typeof item.id === 'string');
  if (!items.some((item) => item.type === 'module-content')) {
    items.unshift(createModuleContentItem());
  }
  return { version: 1, items };
}

export function createModuleWidget(type: Exclude<ModuleWidgetType, 'module-content'>): ModuleLayoutItem {
  const definition = MODULE_WIDGETS.find((widget) => widget.type === type);
  if (!definition) throw new Error(`Tipo de bloque no reconocido: ${type}`);

  return {
    id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: definition.label,
    body: definition.description,
    width: 4,
    height: 'normal',
    background_color: '',
    heading_color: '',
    text_color: '',
    font_family: 'Inter',
    heading_size: 18,
    body_size: 14,
    border_radius: '1rem',
  };
}
