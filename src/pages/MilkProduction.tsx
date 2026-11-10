import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Milk, Calendar, Search } from 'lucide-react';
import type { Animal, MilkProduction } from '../lib/types';
import { apiRequest } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { Modal, Field, TextInput, TextArea, Button, EmptyState, ConfirmDialog } from '../components/ui';
import { AnimalPicker } from '../components/AnimalPicker';
import { getAnimalDisplayName } from '../lib/animalDisplay';
import { useAuth } from '../lib/auth';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface MilkProductionResponse extends Omit<MilkProduction, 'animal_id' | 'morning_liters' | 'afternoon_liters' | 'total_liters' | 'animal'> {
  morning_liters: string;
  afternoon_liters: string;
  total_liters: string;
  animal?: Pick<Animal, 'id' | 'name' | 'ica_code' | 'category' | 'species' | 'sex' | 'notes' | 'breed'> | null;
  animal_id?: string;
}

interface AnimalCategoryOption {
  code: string;
  label: string;
  species: string;
}

function normalizeRecord(record: MilkProductionResponse): MilkProduction {
  return {
    ...record,
    animal: record.animal ?? undefined,
    animal_id: record.animal?.id ?? record.animal_id ?? '',
    morning_liters: Number(record.morning_liters),
    afternoon_liters: Number(record.afternoon_liters),
    total_liters: Number(record.total_liters),
  };
}

export function MilkProductionPage() {
  const { profile } = useAuth();
  const isWorker = profile?.role === 'trabajador';
  const [records, setRecords] = useState<MilkProduction[]>([]);
  const [cows, setCows] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MilkProduction | null>(null);
  const [form, setForm] = useState({
    animal_id: '',
    date: localDateValue(),
    morning_liters: '',
    afternoon_liters: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>(
    profile?.role === 'trabajador' ? 'today' : 'week',
  );
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const params = new URLSearchParams();
    const today = new Date();
    const effectivePeriod = isWorker ? 'today' : period;
    if (effectivePeriod === 'today') {
      params.set('date_from', localDateValue(today));
      params.set('date_to', localDateValue(today));
    } else if (effectivePeriod === 'week') {
      params.set('date_from', localDateValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)));
    } else if (effectivePeriod === 'month') {
      params.set('date_from', localDateValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)));
    }
    if (!isWorker && search.trim()) params.set('search', search.trim());
    try {
      const query = params.size ? `?${params.toString()}` : '';
      const data = await apiRequest<MilkProductionResponse[]>(`/api/milk-production/${query}`);
      setRecords(data.map(normalizeRecord));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudieron cargar los registros.');
    } finally {
      setLoading(false);
    }
  }, [isWorker, period, search]);

  const loadCows = useCallback(async () => {
    try {
      const [animals, categories] = await Promise.all([
        apiRequest<Animal[]>('/api/animals/?species=bovino&active=true'),
        apiRequest<AnimalCategoryOption[]>('/api/animal-categories/'),
      ]);
      const eligibleCategories = categories.filter((category) => (
        ['bovino', 'all'].includes(category.species)
        && category.label.toLocaleLowerCase().includes('lechera')
      ));
      setCows(animals.filter((animal) => (
        animal.sex === 'hembra'
        && (animal.lactation_status === 'parida'
          || eligibleCategories.some((category) => category.code === animal.category))
      )));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudieron cargar las vacas.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useOfflineSyncRefresh(() => { void load(); });
  useEffect(() => { loadCows(); }, [loadCows]);

  const openNew = () => {
    setEditing(null);
    setForm({
      animal_id: '',
      date: localDateValue(),
      morning_liters: '',
      afternoon_liters: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (r: MilkProduction) => {
    setEditing(r);
    setForm({
      animal_id: r.animal_id,
      date: r.date,
      morning_liters: r.morning_liters.toString(),
      afternoon_liters: r.afternoon_liters.toString(),
      notes: r.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setPageError(null);
    const payload = {
      animal_id: form.animal_id,
      date: form.date,
      morning_liters: parseFloat(form.morning_liters) || 0,
      afternoon_liters: parseFloat(form.afternoon_liters) || 0,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await apiRequest<MilkProductionResponse>(`/api/milk-production/${editing.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<MilkProductionResponse>('/api/milk-production/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo guardar el registro.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setPageError(null);
    try {
      await apiRequest<void>(`/api/milk-production/${deleteId}/`, { method: 'DELETE' });
      setDeleteId(null);
      await load();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo eliminar el registro.');
    }
  };

  const totalLiters = records.reduce((s, r) => s + (r.total_liters ?? 0), 0);
  const totalMorning = records.reduce((s, r) => s + (r.morning_liters ?? 0), 0);
  const totalAfternoon = records.reduce((s, r) => s + (r.afternoon_liters ?? 0), 0);
  const avgPerRecord = records.length > 0 ? (totalLiters / records.length).toFixed(1) : '0';
  const cowsMilkedToday = new Set(records.map((record) => record.animal_id)).size;

  return (
    <div className="space-y-5">
      {pageError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}
      {isWorker ? (
        <section className="mt-card space-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium capitalize" style={{ color: 'var(--mt-text-color)' }}>
              {new Intl.DateTimeFormat('es-CO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date())}
            </p>
            <h2 className="text-xl font-bold" style={{ color: 'var(--mt-heading-color)' }}>
              Resumen de ordeño de hoy
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-800">Vacas ordeñadas hoy</p>
              <p className="mt-1 text-3xl font-bold text-emerald-900">
                {loading ? '—' : cowsMilkedToday}
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 p-4">
              <p className="text-sm text-sky-800">Leche producida hoy</p>
              <p className="mt-1 text-3xl font-bold text-sky-900">
                {loading ? '—' : `${totalLiters.toFixed(1)} L`}
              </p>
            </div>
          </div>
          <Button onClick={openNew}>
            <span className="flex items-center gap-2"><Plus size={18} /> Registrar ordeño</span>
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p ? 'text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
                style={period === p ? { backgroundColor: 'var(--mt-accent)' } : undefined}
              >
                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Todo'}
              </button>
            ))}
          </div>
          <Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Registrar ordeño</span></Button>
        </div>
      )}

      {/* Summary */}
      {!isWorker && <div className="mt-grid grid-cols-2 lg:grid-cols-4">
        <div className="mt-card">
          <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Total producido</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{totalLiters.toFixed(1)} L</p>
        </div>
        <div className="mt-card">
          <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Jornada mañana</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalMorning.toFixed(1)} L</p>
        </div>
        <div className="mt-card">
          <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Jornada tarde</p>
          <p className="text-2xl font-bold text-sky-600 mt-1">{totalAfternoon.toFixed(1)} L</p>
        </div>
        <div className="mt-card col-span-2 lg:col-span-1">
          <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Promedio por registro</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{avgPerRecord} L</p>
        </div>
      </div>}

      {/* Search by chapeta */}
      {!isWorker && <div className="relative max-w-sm">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por chapeta ICA..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
        />
      </div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Milk size={28} />}
          title={isWorker ? 'Aún no hay ordeños registrados hoy' : 'No hay registros de producción'}
          description={isWorker ? 'Cuando registres un ordeño, aparecerá en esta lista.' : 'Registra el primer ordeño del día. Solo se muestran hembras paridas o de categoría Lechera.'}
          action={!isWorker && <Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Registrar ordeño</span></Button>}
        />
      ) : isWorker ? (
        <div className="space-y-3">
          {records.map((record) => (
            <article key={record.id} className="mt-card flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold" style={{ color: 'var(--mt-heading-color)' }}>
                  {record.animal ? getAnimalDisplayName(record.animal) : 'Vaca'}
                </p>
                <p className="text-sm" style={{ color: 'var(--mt-text-color)' }}>
                  Mañana {record.morning_liters.toFixed(1)} L · Tarde {record.afternoon_liters.toFixed(1)} L
                </p>
              </div>
              <p className="text-lg font-bold text-emerald-700">{record.total_liters.toFixed(1)} L</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200" style={{ backgroundColor: 'var(--mt-table-header-bg)' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Chapeta</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mañana (L)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tarde (L)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total (L)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="mt-table-row group">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(r.date).toLocaleDateString('es-CO')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.animal?.ica_code ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-right text-amber-700 font-medium">{r.morning_liters}</td>
                    <td className="px-4 py-3 text-sm text-right text-sky-700 font-medium">{r.afternoon_liters}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">{r.total_liters}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><Pencil size={15} /></button>
                        <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar ordeño' : 'Registrar ordeño'}>
        <div className="space-y-4">
          <Field label="Vaca *">
            <AnimalPicker
              animals={cows}
              value={form.animal_id}
              onChange={(animal_id) => setForm({ ...form, animal_id })}
            />
          </Field>
          <Field label="Fecha *">
            <TextInput
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              disabled={isWorker}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jornada mañana (L)">
              <TextInput type="number" step="0.01" value={form.morning_liters} onChange={(e) => setForm({ ...form, morning_liters: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Jornada tarde (L)">
              <TextInput type="number" step="0.01" value={form.afternoon_liters} onChange={(e) => setForm({ ...form, afternoon_liters: e.target.value })} placeholder="0" />
            </Field>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <span className="text-sm text-emerald-700">Total del día: </span>
            <span className="text-lg font-bold text-emerald-700">
              {((parseFloat(form.morning_liters) || 0) + (parseFloat(form.afternoon_liters) || 0)).toFixed(2)} L
            </span>
          </div>
          <Field label="Observaciones">
            <TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.animal_id}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar registro"
        message="¿Seguro que deseas eliminar este registro de producción?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
