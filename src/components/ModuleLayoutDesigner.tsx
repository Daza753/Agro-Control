import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { createDefaultModuleLayout, createModuleWidget, MODULE_WIDGETS, getModuleLayout } from '../lib/moduleLayout';
import type { ModuleKey } from '../lib/moduleThemes';
import type { ModuleLayoutConfig, ModuleLayoutItem, ModuleWidgetType, ModuleTheme } from '../lib/types';
import { ModuleLayoutDisplay } from './ModuleLayoutDisplay';

interface ModuleLayoutDesignerProps {
  moduleKey: ModuleKey;
  moduleLabel: string;
  layoutConfig?: ModuleLayoutConfig;
  theme: ModuleTheme;
  isDark: boolean;
  logoUrl?: string | null;
  content: React.ReactNode;
  onChange: (layout: ModuleLayoutConfig) => void;
}

function moveItem(items: ModuleLayoutItem[], id: string, offset: number): ModuleLayoutItem[] {
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const reordered = [...items];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  return reordered;
}

function colorValue(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function ModuleLayoutDesigner({
  moduleKey,
  moduleLabel,
  layoutConfig,
  theme,
  isDark,
  logoUrl,
  content,
  onChange,
}: ModuleLayoutDesignerProps) {
  const layout = getModuleLayout(layoutConfig);
  const [selectedItemId, setSelectedItemId] = useState(layout.items[0]?.id ?? 'module-content');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const selectedItem = layout.items.find((item) => item.id === selectedItemId) ?? layout.items[0];
  const moduleContentSelected = selectedItem?.type === 'module-content';

  useEffect(() => {
    setSelectedItemId('module-content');
  }, [moduleKey]);

  const updateLayout = (items: ModuleLayoutItem[]) => onChange({ version: 1, items });

  const updateItem = <K extends keyof ModuleLayoutItem>(key: K, value: ModuleLayoutItem[K]) => {
    if (!selectedItem) return;
    updateLayout(layout.items.map((item) => (
      item.id === selectedItem.id ? { ...item, [key]: value } : item
    )));
  };

  const addItem = (type: Exclude<ModuleWidgetType, 'module-content'>) => {
    const item = createModuleWidget(type);
    updateLayout([...layout.items, item]);
    setSelectedItemId(item.id);
  };

  const reorderItems = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const from = layout.items.findIndex((item) => item.id === sourceId);
    const to = layout.items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const items = [...layout.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    updateLayout(items);
    setSelectedItemId(sourceId);
  };

  const removeItem = (item: ModuleLayoutItem) => {
    if (item.type === 'module-content') return;
    const items = layout.items.filter((candidate) => candidate.id !== item.id);
    updateLayout(items);
    setSelectedItemId(items[0]?.id ?? 'module-content');
  };

  const resetLayout = () => {
    const defaults = createDefaultModuleLayout();
    updateLayout(defaults.items);
    setSelectedItemId('module-content');
  };

  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200';
  const fieldLabelClass = 'block text-xs font-medium text-slate-600';
  const fallbackBackground = isDark && theme.card_bg_color === '#ffffff' ? '#1e293b' : theme.card_bg_color;
  const fallbackHeading = isDark && theme.heading_color === '#1e293b' ? '#f1f5f9' : theme.heading_color;
  const fallbackText = isDark && theme.body_text_color === '#64748b' ? '#cbd5e1' : theme.body_text_color;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="module-layout-title">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="module-layout-title" className="text-sm font-semibold uppercase text-slate-600">
            Editor visual · {moduleLabel}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Agrega bloques de presentación, arrástralos para reordenar y edita su apariencia.
          </p>
        </div>
        <button
          type="button"
          onClick={resetLayout}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw size={14} aria-hidden="true" /> Restablecer bloques
        </button>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(190px,0.8fr)_minmax(320px,2fr)_minmax(230px,0.9fr)]">
        <aside className="space-y-4">
          <section aria-labelledby="layout-catalog-title">
            <h4 id="layout-catalog-title" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Catálogo visual
            </h4>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
              {MODULE_WIDGETS.map((widget) => (
                <button
                  key={widget.type}
                  type="button"
                  onClick={() => addItem(widget.type)}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  aria-label={`Agregar ${widget.label}: ${widget.description}`}
                >
                  <span className="truncate">{widget.label}</span>
                  <Plus size={14} className="shrink-0 text-emerald-700" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="layout-elements-title">
            <h4 id="layout-elements-title" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bloques en el diseño
            </h4>
            <ol className="space-y-2">
              {layout.items.map((item, index) => {
                const protectedContent = item.type === 'module-content';
                return (
                  <li
                    key={item.id}
                    className={`flex items-center gap-1 rounded-lg border p-1 ${
                      selectedItemId === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    }`}
                  >
                    <GripVertical size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className="min-w-0 flex-1 truncate px-1 py-2 text-left text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      aria-current={selectedItemId === item.id ? 'true' : undefined}
                    >
                      {protectedContent ? 'Contenido funcional' : item.title}
                      {protectedContent && <span className="ml-1 text-[10px] text-slate-500">(protegido)</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLayout(moveItem(layout.items, item.id, -1))}
                      disabled={index === 0}
                      aria-label={`Mover ${item.title} hacia arriba`}
                      className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                    >
                      <ChevronUp size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLayout(moveItem(layout.items, item.id, 1))}
                      disabled={index === layout.items.length - 1}
                      aria-label={`Mover ${item.title} hacia abajo`}
                      className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                    >
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item)}
                      disabled={protectedContent}
                      aria-label={`Quitar ${item.title}`}
                      title={protectedContent ? 'El contenido funcional no se puede quitar' : 'Quitar bloque'}
                      className="rounded p-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>

        <div className="min-w-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Lienzo de vista previa</h4>
              <p className="text-[11px] text-slate-500">Arrastra un bloque y suéltalo en la posición deseada.</p>
            </div>
            {draggedItemId && <span className="text-xs text-emerald-700" role="status">Suelta para reordenar</span>}
          </div>
          <ModuleLayoutDisplay
            layoutConfig={layout}
            theme={theme}
            isDark={isDark}
            logoUrl={logoUrl}
            content={content}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onItemDragStart={(id) => {
              setDraggedItemId(id);
              setSelectedItemId(id);
            }}
            onItemDrop={(targetId) => {
              if (draggedItemId) reorderItems(draggedItemId, targetId);
              setDraggedItemId(null);
            }}
            onItemDragEnd={() => setDraggedItemId(null)}
          />
        </div>

        <aside className="rounded-xl border border-slate-200 p-4" aria-labelledby="layout-properties-title">
          <h4 id="layout-properties-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Propiedades
          </h4>
          {!selectedItem ? (
            <p className="text-xs text-slate-500">Selecciona un bloque para editarlo.</p>
          ) : moduleContentSelected ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Contenido funcional del módulo</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Este bloque conserva las pantallas, formularios y acciones reales. Puedes moverlo, pero no eliminarlo ni reducirlo.
              </p>
              <p className="text-xs text-slate-500">Módulo: {moduleLabel}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className={fieldLabelClass}>
                Título
                <input className={fieldClass} value={selectedItem.title} maxLength={80} onChange={(event) => updateItem('title', event.target.value)} />
              </label>
              <label className={fieldLabelClass}>
                Texto
                <textarea className={`${fieldClass} min-h-20 resize-y`} value={selectedItem.body} maxLength={500} onChange={(event) => updateItem('body', event.target.value)} />
              </label>
              <label className={fieldLabelClass}>
                Ancho
                <select
                  className={fieldClass}
                  value={selectedItem.width}
                  onChange={(event) => updateItem('width', Number(event.target.value) as ModuleLayoutItem['width'])}
                >
                  <option value={4}>Un tercio</option>
                  <option value={6}>Mitad</option>
                  <option value={8}>Dos tercios</option>
                  <option value={12}>Completo</option>
                </select>
              </label>
              <label className={fieldLabelClass}>
                Alto
                <select
                  className={fieldClass}
                  value={selectedItem.height}
                  onChange={(event) => updateItem('height', event.target.value as ModuleLayoutItem['height'])}
                >
                  <option value="compact">Compacto</option>
                  <option value="normal">Normal</option>
                  <option value="tall">Alto</option>
                </select>
              </label>
              <label className={fieldLabelClass}>
                Tipografía
                <select
                  className={fieldClass}
                  value={selectedItem.font_family}
                  onChange={(event) => updateItem('font_family', event.target.value as ModuleLayoutItem['font_family'])}
                >
                  <option value="Inter">Inter</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </label>
              <label className={fieldLabelClass}>
                Tamaño del título · {selectedItem.heading_size}px
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={selectedItem.heading_size}
                  onChange={(event) => updateItem('heading_size', Number(event.target.value))}
                  className="mt-2 w-full accent-emerald-600"
                />
              </label>
              <label className={fieldLabelClass}>
                Tamaño del texto · {selectedItem.body_size}px
                <input
                  type="range"
                  min="10"
                  max="20"
                  value={selectedItem.body_size}
                  onChange={(event) => updateItem('body_size', Number(event.target.value))}
                  className="mt-2 w-full accent-emerald-600"
                />
              </label>
              <label className={fieldLabelClass}>
                Bordes
                <select
                  className={fieldClass}
                  value={selectedItem.border_radius}
                  onChange={(event) => updateItem('border_radius', event.target.value as ModuleLayoutItem['border_radius'])}
                >
                  <option value="0rem">Cuadrado</option>
                  <option value="0.5rem">Suave</option>
                  <option value="1rem">Redondo</option>
                  <option value="1.5rem">Muy redondo</option>
                </select>
              </label>
              {([
                ['background_color', 'Fondo', fallbackBackground],
                ['heading_color', 'Título', fallbackHeading],
                ['text_color', 'Texto', fallbackText],
              ] as const).map(([field, label, fallback]) => (
                <label key={field} className={fieldLabelClass}>
                  Color de {label.toLowerCase()}
                  <span className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={colorValue(selectedItem[field], fallback)}
                      onChange={(event) => updateItem(field, event.target.value)}
                      className="h-9 w-11 cursor-pointer rounded border border-slate-300 bg-white p-1"
                      aria-label={`Color de ${label.toLowerCase()}`}
                    />
                    <span className="text-[11px] text-slate-500">
                      {selectedItem[field] || 'Usar color del módulo'}
                    </span>
                  </span>
                  {selectedItem[field] && (
                    <button
                      type="button"
                      onClick={() => updateItem(field, '')}
                      className="mt-1 text-[11px] text-emerald-700 underline"
                    >
                      Usar color del módulo
                    </button>
                  )}
                </label>
              ))}
              <p className="text-[11px] leading-relaxed text-slate-500">
                Los colores de texto con poco contraste se ajustan automáticamente para facilitar la lectura.
              </p>
            </div>
          )}
        </aside>
      </div>
      <p className="text-xs text-slate-500" role="note">
        Los bloques añadidos son elementos de presentación: no crean, editan ni eliminan animales, vacunas ni otros registros.
      </p>
    </section>
  );
}
