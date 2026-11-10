import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ClipboardList } from 'lucide-react';
import type { Animal, DailyActivity } from '../lib/types';
import { apiRequest } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { Modal, Field, TextInput, Select, TextArea, Button, Badge, EmptyState, ConfirmDialog } from '../components/ui';
import { AnimalPicker } from '../components/AnimalPicker';
import { getAnimalDisplayName } from '../lib/animalDisplay';
import { useAuth } from '../lib/auth';

const TYPE_LABELS: Record<string, string> = {
  ordeno: 'Ordeño', alimentacion: 'Alimentación', nacimiento: 'Nacimiento',
  consulta_animal: 'Consulta animal', reporte_enfermedad: 'Reporte enfermedad', otro: 'Otro',
};
const TYPE_COLORS: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'gray'> = {
  ordeno: 'blue', alimentacion: 'green', nacimiento: 'amber', consulta_animal: 'blue', reporte_enfermedad: 'red', otro: 'gray',
};

export function Activities() {
  const { profile } = useAuth();
  const isWorker = profile?.role === 'trabajador';
  const [records, setRecords] = useState<DailyActivity[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DailyActivity | null>(null);
  const [form, setForm] = useState({ activity_type: 'ordeno', description: '', animal_id: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await apiRequest<DailyActivity[]>('/api/daily-activities/'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las actividades.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAux = useCallback(async () => {
    try {
      const animals = await apiRequest<Animal[]>('/api/animals/?active=true');
      setAnimals(animals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos auxiliares.');
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);
  useOfflineSyncRefresh(() => { void load(); });
  useEffect(() => { loadAux(); }, [loadAux]);

  const openNew = () => {
    setEditing(null);
    setForm({ activity_type: 'ordeno', description: '', animal_id: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    setModalOpen(true);
  };

  const openEdit = (r: DailyActivity) => {
    setEditing(r);
    setForm({ activity_type: r.activity_type, description: r.description, animal_id: r.animal_id ?? '', date: r.date, notes: r.notes ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      activity_type: form.activity_type,
      description: form.description.trim(),
      animal_id: form.animal_id || null,
      date: form.date,
      notes: form.notes.trim() || null,
    };
    try {
      const path = editing ? `/api/daily-activities/${editing.id}/` : '/api/daily-activities/';
      await apiRequest(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la actividad.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setError(null);
    try {
      await apiRequest(`/api/daily-activities/${deleteId}/`, { method: 'DELETE' });
      setDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la actividad.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Registro de actividades diarias de la finca</p>
        <Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Nueva actividad</span></Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState icon={<ClipboardList size={28} />} title="No hay actividades registradas" action={<Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Registrar actividad</span></Button>} />
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="mt-card group hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge color={TYPE_COLORS[r.activity_type]}>{TYPE_LABELS[r.activity_type]}</Badge>
                    <span className="text-xs text-slate-400">{new Date(r.date).toLocaleDateString('es-CO')}</span>
                    {r.worker && <span className="text-xs text-slate-500">· {r.worker.full_name}</span>}
                  </div>
                  <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>{r.description}</p>
                  {r.animal && <p className="text-xs text-slate-500 mt-1">Animal: {getAnimalDisplayName(r.animal)}</p>}
                  {r.notes && <p className="text-xs text-slate-400 mt-1 italic">{r.notes}</p>}
                </div>
                <div className={`flex gap-1 ${isWorker ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><Pencil size={15} /></button>
                  {!isWorker && (
                    <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar actividad' : 'Nueva actividad'}>
        <div className="space-y-4">
          <Field label="Tipo de actividad *">
            <Select value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value as DailyActivity['activity_type'] })}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Descripción *">
            <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe la actividad..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha *">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Animal">
              <AnimalPicker
                animals={animals}
                value={form.animal_id}
                onChange={(animal_id) => setForm({ ...form, animal_id })}
                allowEmpty
                emptyLabel="Sin animal"
              />
            </Field>
          </div>
          <Field label="Observaciones">
            <TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.description.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </Modal>

      {!isWorker && (
        <ConfirmDialog open={!!deleteId} title="Eliminar actividad" message="¿Seguro que deseas eliminar esta actividad?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}
