import { useState } from 'react';
import {
  LayoutDashboard, PawPrint, Droplets, Syringe, Pill, Package,
  Wrench, Sprout, Fish, Activity, Stethoscope, FileText, Users,
  Settings as SettingsIcon, Sliders, Check, Loader2, RotateCcw,
} from 'lucide-react';
import type { ModuleTheme } from '../lib/types';
import { apiRequest } from '../lib/api';
import { useModuleThemes, ModuleKey, DEFAULT_THEME } from '../lib/moduleThemes';
import { Button, Field, TextInput } from './ui';

const MODULE_LIST: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Inicio', icon: <LayoutDashboard size={18} /> },
  { key: 'animals', label: 'Animales', icon: <PawPrint size={18} /> },
  { key: 'milk', label: 'Produccion de Leche', icon: <Droplets size={18} /> },
  { key: 'vaccines', label: 'Vacunas', icon: <Syringe size={18} /> },
  { key: 'medications', label: 'Medicamentos', icon: <Pill size={18} /> },
  { key: 'inputs', label: 'Insumos', icon: <Package size={18} /> },
  { key: 'equipment', label: 'Equipos', icon: <Wrench size={18} /> },
  { key: 'crops', label: 'Cultivos', icon: <Sprout size={18} /> },
  { key: 'fish', label: 'Piscicultura', icon: <Fish size={18} /> },
  { key: 'activities', label: 'Actividades', icon: <Activity size={18} /> },
  { key: 'diseases', label: 'Enfermedades', icon: <Stethoscope size={18} /> },
  { key: 'reports', label: 'Reportes', icon: <FileText size={18} /> },
  { key: 'users', label: 'Usuarios', icon: <Users size={18} /> },
  { key: 'settings', label: 'Configuracion', icon: <SettingsIcon size={18} /> },
];

const RADIUS_PRESETS = [
  { label: 'Cuadrado', value: '0rem' },
  { label: 'Suave', value: '0.5rem' },
  { label: 'Redondo', value: '1rem' },
  { label: 'Muy redondo', value: '1.5rem' },
];

const SHADOW_PRESETS = [
  { label: 'Sin sombra', value: 'none' },
  { label: 'Ligera', value: 'sm' },
  { label: 'Media', value: 'md' },
  { label: 'Fuerte', value: 'lg' },
];

const DENSITY_PRESETS = [
  { label: 'Compacto', value: 'compact' },
  { label: 'Normal', value: 'normal' },
  { label: 'Amplio', value: 'comfortable' },
];

const GRID_PRESETS = [
  { label: '2 columnas', value: '2' },
  { label: '3 columnas', value: '3' },
  { label: '4 columnas', value: '4' },
  { label: '5 columnas', value: '5' },
  { label: '6 columnas', value: '6' },
];

const COLOR_PRESETS = [
  '#059669', '#2563eb', '#4f46e5', '#d97706',
  '#dc2626', '#db2777', '#7c3aed', '#0891b2',
  '#65a30d', '#ea580c', '#0d9488', '#475569',
];

interface ModulePreviewData {
  description: string;
  action: string;
  search: string;
  filters?: string[];
  metrics?: { label: string; value: string }[];
  columns: string[];
  rows: string[][];
  statuses?: Record<string, string>;
  cardList?: { title: string; detail: string; status: string }[];
  cardLayout?: 'list' | 'grid';
  panels?: { title: string; items: string[] }[];
  welcome?: string;
  metricsBeforeFilters?: boolean;
  chips?: string[];
}

const MODULE_PREVIEWS: Record<ModuleKey, ModulePreviewData> = {
  dashboard: {
    description: 'Resumen de la finca',
    action: 'Ver animales',
    search: '',
    welcome: 'Bienvenido de nuevo, Oscar Vega · Administrador',
    metrics: [
      { label: 'Animales', value: '128' },
      { label: 'Produccion hoy', value: '246 L' },
      { label: 'Vacunas pendientes', value: '8' },
      { label: 'Cultivos activos', value: '4' },
    ],
    columns: ['Dia', 'Produccion de leche', 'Categoria'],
    rows: [
      ['Lun', '218 L', 'Vacas'],
      ['Mar', '232 L', 'Novillas'],
      ['Mie', '246 L', 'Terneros'],
    ],
  },
  animals: {
    description: 'Inventario y estado del ganado',
    action: 'Nuevo animal',
    search: 'Buscar por chapeta ICA...',
    filters: ['Todas las especies', 'Bovinos', 'Equinos'],
    metrics: [
      { label: 'Total animales', value: '128' },
      { label: 'Vacas', value: '42' },
      { label: 'Novillas', value: '26' },
      { label: 'Terneros', value: '18' },
    ],
    metricsBeforeFilters: true,
    chips: ['Vacas 42', 'Novillas 26', 'Novillos 18', 'Terneros 16'],
    columns: ['Chapeta ICA', 'Categoria', 'Raza', 'Sexo', 'Peso', 'Estado'],
    rows: [
      ['CO-042', 'Vaca (VC)', 'Holstein', 'Hembra', '428 kg', 'Sano'],
      ['CO-057', 'Novilla (NV)', 'Gyr', 'Hembra', '286 kg', 'Sano'],
      ['CO-061', 'Ternero (TE)', 'Cruzado', 'Macho', '174 kg', 'En tratamiento'],
    ],
    statuses: { Sano: 'green', 'En tratamiento': 'amber' },
  },
  milk: {
    description: 'Control diario de ordeños por chapeta',
    action: 'Registrar ordeno',
    search: 'Buscar por chapeta ICA...',
    filters: ['Hoy', 'Semana', 'Mes', 'Todo'],
    metrics: [
      { label: 'Total producido', value: '246.0 L' },
      { label: 'Jornada manana', value: '132.0 L' },
      { label: 'Jornada tarde', value: '114.0 L' },
      { label: 'Promedio por registro', value: '12.3 L' },
    ],
    columns: ['Fecha', 'Chapeta', 'Manana (L)', 'Tarde (L)', 'Total (L)'],
    rows: [
      ['05/10/2026', 'CO-042', '18.5', '16.0', '34.5'],
      ['05/10/2026', 'CO-057', '14.0', '12.5', '26.5'],
      ['05/10/2026', 'CO-061', '—', '—', '—'],
    ],
  },
  vaccines: {
    description: 'Calendario y seguimiento sanitario',
    action: 'Programar vacuna',
    search: '',
    filters: ['Todas', 'Pendientes', 'Proximas', 'Aplicadas', 'Vencidas'],
    columns: ['Vacuna', 'Animal', 'Programada', 'Dosis', 'Estado'],
    rows: [
      ['Aftosa', 'CO-042 · La Morena', '12/10/2026', '5 ml', 'Pendiente'],
      ['Brucelosis', 'CO-057 · Lucero', '08/10/2026', '2 ml', 'Proxima'],
      ['Clostridiosis', 'CO-061 · Ternero', '01/10/2026', '3 ml', 'Aplicada'],
    ],
    statuses: { Pendiente: 'amber', Proxima: 'red', Aplicada: 'green' },
    cardList: [
      { title: 'Aftosa', detail: 'CO-042 · Programada: 12/10/2026 · Dosis: 5 ml', status: 'Pendiente' },
      { title: 'Brucelosis', detail: 'CO-057 · Programada: 08/10/2026 · Dosis: 2 ml', status: 'Proxima' },
    ],
  },
  medications: {
    description: 'Inventario de medicamentos veterinarios',
    action: 'Nuevo medicamento',
    search: 'Buscar medicamento...',
    filters: ['Todos los tipos', 'Antibiotico', 'Vitamina'],
    columns: ['Nombre', 'Tipo', 'Cantidad', 'Dosis', 'Vence', 'Proveedor'],
    rows: [
      ['Oxitetraciclina', 'Antibiotico', '1.500 ml', '10 ml / 100 kg', '15/03/2027', 'Agrovet'],
      ['Complejo B', 'Vitamina', '820 ml', '5 ml / animal', '20/06/2027', 'Finca Sana'],
      ['Ivermectina', 'Desparasitante', '640 ml', '1 ml / 50 kg', '12/01/2027', 'Agrovet'],
    ],
    statuses: { Antibiotico: 'blue', Vitamina: 'green', Desparasitante: 'amber' },
  },
  inputs: {
    description: 'Existencias de insumos agricolas',
    action: 'Nuevo insumo',
    search: 'Buscar insumo...',
    filters: ['Todos los tipos', 'Fertilizante', 'Semilla'],
    columns: ['Nombre', 'Tipo', 'Existencias', 'Proveedor', 'Compra', 'Precio'],
    rows: [
      ['Urea granulada', 'Fertilizante', '120 kg', 'Agroinsumos del Valle', '18/09/2026', '$ 420.000'],
      ['Semilla de maiz', 'Semilla', '35 kg', 'Semillas Andinas', '12/09/2026', '$ 280.000'],
      ['Glifosato', 'Herbicida', '18 L', 'Agroinsumos del Valle', '02/09/2026', '$ 315.000'],
    ],
    statuses: { Fertilizante: 'green', Semilla: 'blue', Herbicida: 'amber' },
  },
  equipment: {
    description: 'Estado y mantenimiento de equipos',
    action: 'Nuevo equipo',
    search: 'Buscar equipo...',
    filters: ['Todos los estados', 'Bueno', 'En reparacion'],
    columns: ['Nombre', 'Tipo', 'Estado', 'Ult. mantenimiento', 'Prox. mantenimiento'],
    rows: [
      ['Tractor principal', 'Tractor', 'Bueno', '10/08/2026', '10/11/2026'],
      ['Guadana Stihl', 'Herramienta', 'En reparacion', '02/10/2026', '15/10/2026'],
      ['Bomba fumigadora', 'Fumigacion', 'Regular', '21/07/2026', '21/10/2026'],
    ],
    statuses: { Bueno: 'green', 'En reparacion': 'blue', Regular: 'amber' },
  },
  crops: {
    description: 'Seguimiento de siembra, area y produccion',
    action: 'Nuevo cultivo',
    search: 'Buscar cultivo...',
    filters: ['Todos los estados', 'Activo', 'Cosechado'],
    columns: ['Nombre', 'Tipo', 'Area', 'Siembra', 'Produccion', 'Estado'],
    rows: [
      ['Lote norte', 'Maiz', '2,5 ha', '15/06/2026', '—', 'Activo'],
      ['Parcela 3', 'Yuca', '1,2 ha', '04/02/2026', '3.200 kg', 'Cosechado'],
      ['Potrero central', 'Pasto', '4 ha', '20/07/2026', '—', 'Activo'],
    ],
    statuses: { Activo: 'green', Cosechado: 'blue' },
  },
  fish: {
    description: 'Control de estanques, poblacion y produccion',
    action: 'Nuevo estanque',
    search: 'Buscar estanque...',
    filters: ['Todos los estados', 'Activo', 'Cosechado'],
    columns: ['Estanque', 'Especie', 'Cantidad', 'Peso prom.', 'Mortalidad', 'Produccion', 'Estado'],
    rows: [
      ['Estanque 1', 'Tilapia roja', '1.200', '0,42 kg', '12', '310 kg', 'Activo'],
      ['Estanque 2', 'Cachama', '850', '0,65 kg', '8', '420 kg', 'Activo'],
      ['Estanque 3', 'Tilapia roja', '—', '—', '—', '280 kg', 'Cosechado'],
    ],
    statuses: { Activo: 'green', Cosechado: 'blue' },
  },
  activities: {
    description: 'Bitacora diaria del trabajo en la finca',
    action: 'Nueva actividad',
    search: 'Buscar actividad...',
    filters: ['Todas las fechas', 'Tipo de actividad'],
    columns: ['Fecha', 'Tipo', 'Descripcion', 'Animal', 'Responsable'],
    rows: [
      ['05/10/2026', 'Ordeno', 'Ordeño de la mañana', 'CO-042', 'Oscar Vega'],
      ['05/10/2026', 'Alimentacion', 'Suplemento lote norte', 'Lote norte', 'Maria Ruiz'],
      ['04/10/2026', 'Consulta animal', 'Revision de rutina', 'CO-057', 'Oscar Vega'],
    ],
    cardLayout: 'list',
    cardList: [
      { title: 'Ordeño · 05/10/2026', detail: 'Ordeño de la mañana · Animal: La Morena (CO-042) · Oscar Vega', status: 'Ordeno' },
      { title: 'Alimentacion · 05/10/2026', detail: 'Suplemento lote norte · Responsable: Maria Ruiz', status: 'Alimentacion' },
      { title: 'Consulta animal · 04/10/2026', detail: 'Revision de rutina · Animal: Lucero (CO-057)', status: 'Consulta animal' },
    ],
    statuses: { Ordeno: 'blue', Alimentacion: 'green', 'Consulta animal': 'amber' },
  },
  diseases: {
    description: 'Reportes, diagnosticos y tratamientos',
    action: 'Nuevo reporte',
    search: 'Buscar reporte...',
    filters: ['Todos los estados', 'Abierto', 'En tratamiento', 'Resuelto'],
    columns: ['Fecha', 'Animal', 'Sintomas', 'Diagnostico', 'Tratamiento', 'Estado'],
    rows: [
      ['05/10/2026', 'CO-061 · Ternero', 'Fiebre y decaimiento', 'Infeccion respiratoria', 'Antibiotico', 'En tratamiento'],
      ['02/10/2026', 'CO-042 · La Morena', 'Cojera', 'Lesion leve', 'Reposo', 'Resuelto'],
      ['01/10/2026', 'CO-073 · Lucero', 'Falta de apetito', 'En revision', 'Pendiente', 'Abierto'],
    ],
    statuses: { 'En tratamiento': 'amber', Resuelto: 'green', Abierto: 'red' },
    cardList: [
      { title: 'La Morena · CO-042', detail: 'Fecha: 05/10/2026 · Sintomas: Fiebre y decaimiento · Diagnostico: Infeccion respiratoria · Tratamiento: Antibiotico', status: 'En tratamiento' },
      { title: 'Lucero · CO-057', detail: 'Fecha: 02/10/2026 · Sintomas: Cojera · Diagnostico: Lesion leve · Tratamiento: Reposo', status: 'Resuelto' },
      { title: 'Lucero · CO-073', detail: 'Fecha: 01/10/2026 · Sintomas: Falta de apetito · Diagnostico: En revision · Tratamiento: Pendiente', status: 'Abierto' },
    ],
    cardLayout: 'grid',
  },
  reports: {
    description: 'Indicadores consolidados de la finca',
    action: 'Exportar CSV',
    search: '',
    metrics: [
      { label: 'Produccion (30 dias)', value: '6.420 L' },
      { label: 'Total animales', value: '128' },
      { label: 'Vacunas pendientes', value: '8' },
      { label: 'Cultivos activos', value: '4' },
    ],
    columns: ['Indicador', 'Periodo', 'Resultado'],
    rows: [
      ['Produccion de leche', 'Ultimos 30 dias', '6.420 L'],
      ['Inventario animal', 'Hoy', '128 animales'],
      ['Vacunas aplicadas', 'Ultimos 30 dias', '24'],
    ],
    panels: [
      { title: 'Inventario por especie', items: ['Bovinos · 82', 'Equinos · 18', 'Ovinos · 28'] },
      { title: 'Vacunas', items: ['Pendientes · 8', 'Aplicadas · 24'] },
      { title: 'Inventario de medicamentos', items: ['Oxitetraciclina · 1.500 ml', 'Complejo B · 820 ml'] },
      { title: 'Inventario de insumos', items: ['Urea granulada · 120 kg', 'Semilla de maiz · 35 kg'] },
    ],
  },
  users: {
    description: 'Cuentas, roles y acceso al sistema',
    action: 'Nuevo usuario',
    search: 'Buscar usuario...',
    filters: ['Todos los roles', 'Administrador', 'Trabajador'],
    columns: ['Nombre', 'Correo', 'Rol', 'Estado'],
    rows: [
      ['Oscar Vega', 'oscar@finca.com', 'Administrador', 'Activo'],
      ['Maria Ruiz', 'maria@finca.com', 'Trabajador', 'Activo'],
      ['Carlos Diaz', 'carlos@finca.com', 'Trabajador', 'Inactivo'],
    ],
    statuses: { Administrador: 'green', Trabajador: 'blue', Activo: 'green', Inactivo: 'gray' },
    cardList: [
      { title: 'Oscar Vega', detail: 'oscar@finca.com', status: 'Administrador' },
      { title: 'Maria Ruiz', detail: 'maria@finca.com', status: 'Trabajador' },
      { title: 'Carlos Diaz', detail: 'carlos@finca.com', status: 'Inactivo' },
    ],
    cardLayout: 'grid',
  },
  settings: {
    description: 'Configuracion de la cuenta y apariencia',
    action: 'Guardar cambios',
    search: '',
    columns: ['Opcion', 'Configuracion', 'Valor actual'],
    rows: [
      ['Datos de finca', 'Nombre visible', 'La Lucha'],
      ['Tema visual', 'Color de acento', '#059669'],
      ['Acceso', 'Rol de usuario', 'Administrador'],
    ],
    panels: [
      { title: 'Informacion de la finca', items: ['Nombre: La Lucha', 'Logo de la finca'] },
      { title: 'Colores del tema', items: ['Color primario', 'Color secundario'] },
      { title: 'Estilo del menu lateral', items: ['Oscuro · Claro'] },
      { title: 'Barra superior', items: ['Claro · Oscuro · Transparente'] },
    ],
  },
};

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  green: { background: '#dcfce7', color: '#15803d' },
  blue: { background: '#dbeafe', color: '#1d4ed8' },
  amber: { background: '#fef3c7', color: '#b45309' },
  red: { background: '#fee2e2', color: '#b91c1c' },
  gray: { background: '#f1f5f9', color: '#475569' },
};

function ModulePreview({ moduleKey, theme }: { moduleKey: ModuleKey; theme: ModuleTheme }) {
  const module = MODULE_PREVIEWS[moduleKey];
  const cardPadding = theme.density === 'compact' ? '0.75rem' : theme.density === 'comfortable' ? '2rem' : theme.card_padding;
  const gridGap = theme.density === 'compact' ? '0.5rem' : theme.density === 'comfortable' ? '1.5rem' : theme.grid_gap;
  const shadow = theme.card_shadow === 'none' ? 'none'
    : theme.card_shadow === 'sm' ? '0 1px 2px rgb(0 0 0 / 0.05)'
      : theme.card_shadow === 'md' ? '0 4px 6px rgb(0 0 0 / 0.1)'
        : '0 10px 15px rgb(0 0 0 / 0.1)';
  const panelStyle: React.CSSProperties = {
    borderRadius: theme.card_radius,
    backgroundColor: theme.card_bg_color,
    border: `1px solid ${theme.card_border_color}`,
    boxShadow: shadow,
  };
  const headingStyle: React.CSSProperties = {
    color: theme.heading_color,
    fontSize: theme.heading_size,
    fontWeight: 700,
  };
  const bodyStyle: React.CSSProperties = {
    color: theme.body_text_color,
    fontSize: theme.body_text_size,
  };
  const columnCount = Math.max(1, Math.min(Number(theme.grid_columns) || 4, module.metrics?.length ?? 4));

  const renderCell = (value: string) => {
    const status = module.statuses?.[value];
    if (!status) return value;
    const colors = STATUS_STYLES[status] ?? STATUS_STYLES.gray;
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium" style={colors}>
        {value}
      </span>
    );
  };

  const renderMetrics = () => module.metrics ? (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gap: gridGap,
      }}
    >
      {module.metrics.map((metric) => (
        <div key={metric.label} className="min-w-0" style={{ ...panelStyle, padding: cardPadding }}>
          <p className="truncate" style={bodyStyle}>{metric.label}</p>
          <p className="mt-1 truncate" style={headingStyle}>{metric.value}</p>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <h4 className="truncate" style={headingStyle}>{MODULE_LIST.find((item) => item.key === moduleKey)?.label}</h4>
          <p className="mt-1 text-xs" style={bodyStyle}>{module.description}</p>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: theme.accent_color, borderRadius: theme.card_radius }}
        >
          <span className="text-base leading-none">+</span>
          <span className="hidden sm:inline">{module.action}</span>
        </button>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        {module.welcome && (
          <div
            className="rounded-xl px-4 py-3 text-white"
            style={{ backgroundColor: theme.accent_color, borderRadius: theme.card_radius }}
          >
            <p className="text-xs text-white/80">Bienvenido de nuevo,</p>
            <p className="mt-1 font-semibold">{module.welcome.replace('Bienvenido de nuevo, ', '')}</p>
          </div>
        )}

        {module.metricsBeforeFilters && renderMetrics()}

        {(module.search || module.filters) && (
          <div className="flex flex-wrap items-center gap-2">
            {module.search && (
              <div className="min-w-36 flex-1 rounded-lg border px-3 py-2 text-xs" style={{ ...panelStyle, color: theme.body_text_color }}>
                {module.search}
              </div>
            )}
            {module.filters?.map((filter, index) => (
              <span
                key={filter}
                className="rounded-lg border px-2.5 py-1.5 text-[10px] sm:text-xs"
                style={{
                  borderColor: index === 0 ? theme.accent_color : theme.card_border_color,
                  backgroundColor: index === 0 ? `${theme.accent_color}15` : theme.card_bg_color,
                  color: index === 0 ? theme.accent_color : theme.body_text_color,
                }}
              >
                {filter}
              </span>
            ))}
          </div>
        )}

        {!module.metricsBeforeFilters && renderMetrics()}

        {module.chips && (
          <div className="flex flex-wrap gap-2">
            {module.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-lg border px-3 py-1.5 text-xs"
                style={{ borderColor: theme.card_border_color, color: theme.heading_color, backgroundColor: theme.card_bg_color }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {module.cardList ? (
          <div
            className="grid"
            style={{
              gridTemplateColumns: module.cardLayout === 'list'
                ? 'minmax(0, 1fr)'
                : `repeat(${Math.max(1, Math.min(Number(theme.grid_columns) || 4, module.cardList.length))}, minmax(0, 1fr))`,
              gap: gridGap,
            }}
          >
            {module.cardList.map((card) => (
              <article key={card.title} style={{ ...panelStyle, padding: cardPadding }}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h5 style={headingStyle}>{card.title}</h5>
                  {renderCell(card.status)}
                </div>
                <p style={bodyStyle}>{card.detail}</p>
              </article>
            ))}
          </div>
        ) : module.panels ? (
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gap: gridGap,
            }}
          >
            {module.panels.map((panel) => (
              <section key={panel.title} style={{ ...panelStyle, padding: cardPadding }}>
                <h5 className="mb-2" style={headingStyle}>{panel.title}</h5>
                {panel.items.map((item) => <p key={item} style={bodyStyle}>{item}</p>)}
              </section>
            ))}
          </div>
        ) : moduleKey === 'dashboard' ? (
          <div className="grid gap-3 lg:grid-cols-3" style={{ gap: gridGap }}>
            <section className="lg:col-span-2" style={{ ...panelStyle, padding: cardPadding }}>
              <h5 className="mb-3" style={headingStyle}>Produccion de leche (7 dias)</h5>
              <div className="flex h-24 items-end gap-2">
                {[42, 57, 48, 76, 63, 88, 72].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end rounded-t" style={{ backgroundColor: `${theme.accent_color}20` }}>
                    <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: theme.accent_color }} />
                  </div>
                ))}
              </div>
            </section>
            <section style={{ ...panelStyle, padding: cardPadding }}>
              <h5 className="mb-3" style={headingStyle}>Ganado por categoria</h5>
              {['Vacas', 'Novillas', 'Terneros'].map((label, index) => (
                <div key={label} className="mb-2">
                  <div className="mb-1 flex justify-between text-xs" style={bodyStyle}><span>{label}</span><span>{42 - index * 9}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{ width: `${80 - index * 18}%`, backgroundColor: theme.accent_color }} /></div>
                </div>
              ))}
            </section>
          </div>
        ) : (
          <div className="overflow-x-auto" style={panelStyle}>
            <table className="w-full border-collapse text-left">
              <thead style={{ backgroundColor: theme.table_header_bg }}>
                <tr>
                  {module.columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase sm:text-xs" style={{ color: theme.body_text_color }}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {module.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ backgroundColor: rowIndex % 2 ? theme.table_row_hover_bg : theme.card_bg_color }}>
                    {row.map((value, columnIndex) => (
                      <td key={`${rowIndex}-${columnIndex}`} className="whitespace-nowrap border-t px-3 py-2 text-[10px] sm:text-xs" style={{ borderColor: theme.card_border_color, color: theme.body_text_color }}>
                        {renderCell(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-slate-400">
          Vista de ejemplo con datos ficticios. Los controles de arriba se reflejan aqui y se aplican al modulo seleccionado.
        </p>
      </div>
    </div>
  );
}

export function ModuleThemeEditor() {
  const { themes, getTheme, updateTheme, refresh } = useModuleThemes();
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('dashboard');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = getTheme(selectedModule);

  const updateField = <K extends keyof ModuleTheme>(key: K, value: ModuleTheme[K]) => {
    updateTheme(selectedModule, { [key]: value });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const t = getTheme(selectedModule);
    const payload = {
      module_key: selectedModule,
      card_radius: t.card_radius,
      card_padding: t.card_padding,
      card_border_color: t.card_border_color,
      card_bg_color: t.card_bg_color,
      card_shadow: t.card_shadow,
      grid_columns: t.grid_columns,
      grid_gap: t.grid_gap,
      heading_size: t.heading_size,
      heading_color: t.heading_color,
      body_text_size: t.body_text_size,
      body_text_color: t.body_text_color,
      accent_color: t.accent_color,
      table_header_bg: t.table_header_bg,
      table_row_hover_bg: t.table_row_hover_bg,
      density: t.density,
    };

    try {
      const path = t.id ? `/api/module-themes/${t.id}/` : '/api/module-themes/';
      await apiRequest(path, { method: t.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setSaved(true);
      refresh();
    } catch (error) {
      console.error('Error saving module theme:', error);
      setError(error instanceof Error ? error.message : 'No se pudo guardar el tema.');
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const resetModule = async () => {
    updateTheme(selectedModule, {
      ...DEFAULT_THEME,
      module_key: selectedModule,
      id: theme.id,
      updated_at: theme.updated_at,
      updated_by: theme.updated_by,
    });
    setSaved(false);
  };

  const applyToAll = async () => {
    setSaving(true);
    setError(null);
    const t = getTheme(selectedModule);
    const allThemes = MODULE_LIST.map((m) => ({
      module_key: m.key,
      card_radius: t.card_radius,
      card_padding: t.card_padding,
      card_border_color: t.card_border_color,
      card_bg_color: t.card_bg_color,
      card_shadow: t.card_shadow,
      grid_columns: t.grid_columns,
      grid_gap: t.grid_gap,
      heading_size: t.heading_size,
      heading_color: t.heading_color,
      body_text_size: t.body_text_size,
      body_text_color: t.body_text_color,
      accent_color: t.accent_color,
      table_header_bg: t.table_header_bg,
      table_row_hover_bg: t.table_row_hover_bg,
      density: t.density,
    }));

    try {
      for (const payload of allThemes) {
        const existing = themes[payload.module_key];
        const path = existing?.id ? `/api/module-themes/${existing.id}/` : '/api/module-themes/';
        await apiRequest(path, {
          method: existing?.id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        });
      }
      setSaved(true);
      refresh();
    } catch (error) {
      console.error('Error applying module theme to all modules:', error);
      setError(error instanceof Error ? error.message : 'No se pudieron aplicar los cambios a todos los módulos.');
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sliders size={24} /> Diseno por Modulo
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Personaliza el diseno de cada modulo individualmente: colores, formas, tamaños, ubicaciones
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {/* Module selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-600 mb-3">Selecciona un modulo para personalizar:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {MODULE_LIST.map((m) => (
            <button
              key={m.key}
              onClick={() => { setSelectedModule(m.key); setSaved(false); }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                selectedModule === m.key
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <span className={selectedModule === m.key ? 'text-emerald-600' : 'text-slate-500'}>
                {m.icon}
              </span>
              <span className={`text-xs font-medium text-center ${selectedModule === m.key ? 'text-emerald-700' : 'text-slate-600'}`}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div>
          <h3 className="text-sm font-semibold uppercase text-slate-500">
            Vista previa realista: {MODULE_LIST.find((item) => item.key === selectedModule)?.label}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Cambia una opcion para ver como se refleja en las tarjetas, textos, tablas y botones de este modulo.
          </p>
        </div>
        <ModulePreview moduleKey={selectedModule} theme={theme} />
      </div>

      {/* Controls */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Card styling */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Cajones / Tarjetas</h3>
          <div className="space-y-4">
            <Field label="Forma (bordes redondeados)">
              <div className="grid grid-cols-4 gap-2">
                {RADIUS_PRESETS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => updateField('card_radius', r.value)}
                    className={`p-2 text-center border-2 transition-all ${theme.card_radius === r.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
                    style={{ borderRadius: r.value }}
                  >
                    <span className="text-xs font-medium text-slate-600">{r.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Color de borde">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.card_border_color}
                  onChange={(e) => updateField('card_border_color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={theme.card_border_color}
                  onChange={(e) => updateField('card_border_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>

            <Field label="Color de fondo">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.card_bg_color}
                  onChange={(e) => updateField('card_bg_color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={theme.card_bg_color}
                  onChange={(e) => updateField('card_bg_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>

            <Field label="Sombra">
              <div className="grid grid-cols-4 gap-2">
                {SHADOW_PRESETS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateField('card_shadow', s.value)}
                    className={`p-2 text-xs font-medium border-2 rounded-lg transition-all ${theme.card_shadow === s.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Densidad (tamaño de cajones)">
              <div className="grid grid-cols-3 gap-2">
                {DENSITY_PRESETS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => updateField('density', d.value as ModuleTheme['density'])}
                    className={`p-2.5 text-xs font-medium border-2 rounded-lg transition-all ${theme.density === d.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        {/* Layout & Typography */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Ubicacion y Texto</h3>
          <div className="space-y-4">
            <Field label="Columnas del grid">
              <div className="grid grid-cols-5 gap-2">
                {GRID_PRESETS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => updateField('grid_columns', g.value)}
                    className={`p-2 text-xs font-medium border-2 rounded-lg transition-all ${theme.grid_columns === g.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Espacio entre cajones">
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.25"
                  value={theme.grid_gap.replace('rem', '')}
                  onChange={(e) => updateField('grid_gap', `${e.target.value}rem`)}
                  className="flex-1"
                />
                <span className="text-sm text-slate-600 w-12">{theme.grid_gap}</span>
              </div>
            </Field>

            <Field label="Color de acento (botones, iconos)">
              <div className="flex gap-2 flex-wrap mb-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateField('accent_color', c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${theme.accent_color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.accent_color}
                  onChange={(e) => updateField('accent_color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={theme.accent_color}
                  onChange={(e) => updateField('accent_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>

            <Field label="Tamaño de titulos">
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.125"
                  value={theme.heading_size.replace('rem', '')}
                  onChange={(e) => updateField('heading_size', `${e.target.value}rem`)}
                  className="flex-1"
                />
                <span className="text-sm text-slate-600 w-12">{theme.heading_size}</span>
              </div>
            </Field>

            <Field label="Color de titulos">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.heading_color}
                  onChange={(e) => updateField('heading_color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={theme.heading_color}
                  onChange={(e) => updateField('heading_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>

            <Field label="Color de texto del cuerpo">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.body_text_color}
                  onChange={(e) => updateField('body_text_color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={theme.body_text_color}
                  onChange={(e) => updateField('body_text_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>

            <Field label="Color de encabezado de tabla">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.table_header_bg}
                  onChange={(e) => updateField('table_header_bg', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={theme.table_header_bg}
                  onChange={(e) => updateField('table_header_bg', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button variant="secondary" onClick={resetModule}>
          <RotateCcw size={18} className="mr-2" /> Restablecer este modulo
        </Button>
        <Button variant="secondary" onClick={applyToAll} disabled={saving}>
          Aplicar a todos los modulos
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : saved ? <Check size={18} className="mr-2" /> : null}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar este modulo'}
        </Button>
      </div>
    </div>
  );
}
