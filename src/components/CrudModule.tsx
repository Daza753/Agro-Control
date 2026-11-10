import { useEffect, useState, useCallback, ReactNode } from 'react';
import { Plus, Search, Pencil, Trash2, Filter } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { Modal, Field, TextInput, Select, TextArea, Button, Badge, EmptyState, ConfirmDialog } from './ui';
import { useAuth } from '../lib/auth';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  step?: string;
}

export interface CrudConfig<T> {
  table: string;
  title: string;
  singular: string;
  icon: ReactNode;
  fields: FieldDef[];
  columns: Column<T>[];
  searchFields: string[];
  filterField?: { name: keyof T; label: string; options: { value: string; label: string }[] };
  badgeField?: { name: keyof T; map: Record<string, { label: string; color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'amber' }> };
  defaultForm: Record<string, string | number | null>;
}

export function CrudModule<T extends { id: string }>({ config }: { config: CrudConfig<T> }) {
  const { profile } = useAuth();
  const isWorker = profile?.role === 'trabajador';
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string | number | null>>(config.defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (config.filterField && filter !== 'all') {
      params.set(String(config.filterField.name), filter);
    }
    if (search.trim()) params.set('search', search.trim());
    try {
      const endpoint = config.table.replace(/_/g, '-');
      const query = params.size ? `?${params.toString()}` : '';
      setRows(await apiRequest<T[]>(`/api/${endpoint}/${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  }, [config.table, config.filterField, filter, search]);

  useEffect(() => { load(); }, [load]);
  useOfflineSyncRefresh(() => { void load(); });

  const openNew = () => {
    setEditing(null);
    setForm(config.defaultForm);
    setModalOpen(true);
  };

  const openEdit = (row: T) => {
    setEditing(row);
    const f: Record<string, string | number | null> = {};
    for (const def of config.fields) {
      const val = row[def.name as keyof T];
      f[def.name] = val == null
        ? ''
        : def.type === 'date' && typeof val === 'string'
          ? val.slice(0, 10)
          : typeof val === 'string' || typeof val === 'number'
            ? val
            : String(val);
    }
    setForm(f);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const def of config.fields) {
      let v = form[def.name];
      if (def.type === 'number') v = v === '' ? null : parseFloat(String(v));
      else if (def.type === 'date') v = v || null;
      else if (def.type === 'text' || def.type === 'textarea') v = String(v ?? '').trim() || null;
      payload[def.name] = v;
    }
    try {
      const endpoint = `/api/${config.table.replace(/_/g, '-')}/`;
      await apiRequest(editing ? `${endpoint}${editing.id}/` : endpoint, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el registro.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setError(null);
    try {
      await apiRequest(`/api/${config.table.replace(/_/g, '-')}/${deleteId}/`, { method: 'DELETE' });
      setDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el registro.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${config.singular.toLowerCase()}...`}
              className="mt-input w-full pl-10 pr-4 py-2.5"
            />
          </div>
          {config.filterField && (
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="mt-input pl-9 pr-8 py-2.5"
              >
                <option value="all">{config.filterField.label}</option>
                {config.filterField.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Button onClick={openNew}>
          <span className="flex items-center gap-2"><Plus size={18} /> {isWorker ? 'Registrar' : 'Nuevo'}</span>
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--mt-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title={`No hay ${config.title.toLowerCase()} registrados`}
          description={`Agrega tu primer ${config.singular.toLowerCase()} al sistema.`}
          action={<Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Registrar</span></Button>}
        />
      ) : (
        <>
          {isWorker ? (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => (
                <article key={row.id} className="mt-card space-y-4">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {config.columns.map((column) => (
                      <div key={String(column.key)} className={column.className}>
                        <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--mt-text-color)' }}>
                          {column.label}
                        </dt>
                        <dd className="mt-1 text-sm font-medium" style={{ color: 'var(--mt-heading-color)' }}>
                          {column.render
                            ? column.render(row)
                            : String(column.key in row ? row[column.key as keyof T] ?? '—' : '—')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <Button variant="secondary" onClick={() => openEdit(row)}>
                    <span className="flex items-center gap-2"><Pencil size={15} /> Actualizar</span>
                  </Button>
                </article>
              ))}
            </div>
          ) : (
          <div className="mt-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="mt-table-header border-b" style={{ borderColor: 'var(--mt-card-border)' }}>
                    {config.columns.map((c) => (
                      <th key={String(c.key)} className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider ${c.className ?? ''}`} style={{ color: 'var(--mt-text-color)' }}>
                        {c.label}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--mt-text-color)' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--mt-card-border)' }}>
                  {rows.map((row) => (
                    <tr key={row.id} className="mt-table-row transition-colors group">
                      {config.columns.map((c) => (
                        <td key={String(c.key)} className={`px-4 py-3 ${c.className ?? ''}`} style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-heading-color)' }}>
                          {c.render
                            ? c.render(row)
                            : String(c.key in row ? row[c.key as keyof T] ?? '—' : '—')}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteId(row.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
          <p className="text-center" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>{rows.length} registro(s)</p>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Editar ${config.singular.toLowerCase()}` : `Nuevo ${config.singular.toLowerCase()}`} size="lg">
        <div className="grid sm:grid-cols-2 gap-4">
          {config.fields.map((def) => (
            <Field key={def.name} label={`${def.label}${def.required ? ' *' : ''}`} className={def.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {def.type === 'select' ? (
                <Select value={form[def.name] ?? ''} onChange={(e) => setForm({ ...form, [def.name]: e.target.value })}>
                  {def.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : def.type === 'textarea' ? (
                <TextArea rows={3} value={form[def.name] ?? ''} onChange={(e) => setForm({ ...form, [def.name]: e.target.value })} />
              ) : (
                <TextInput
                  type={def.type}
                  step={def.step}
                  value={form[def.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [def.name]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </Modal>

      {!isWorker && (
        <ConfirmDialog
          open={!!deleteId}
          title={`Eliminar ${config.singular.toLowerCase()}`}
          message="¿Seguro que deseas eliminar este registro? Esta acción no se puede deshacer."
          error={error ?? undefined}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

export { Badge };
