import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Stethoscope } from 'lucide-react';
import type { Animal, DiseaseReport } from '../lib/types';
import { apiRequest } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { Modal, Field, TextInput, Select, TextArea, Button, Badge, EmptyState, ConfirmDialog } from '../components/ui';
import { AnimalPicker } from '../components/AnimalPicker';
import { getAnimalDisplayName } from '../lib/animalDisplay';
import { useAuth } from '../lib/auth';

const STATUS_LABELS: Record<string, string> = { abierto: 'Abierto', en_tratamiento: 'En tratamiento', resuelto: 'Resuelto' };
const STATUS_COLORS: Record<string, 'red' | 'yellow' | 'green'> = { abierto: 'red', en_tratamiento: 'yellow', resuelto: 'green' };

export function Diseases() {
  const { profile } = useAuth();
  const isWorker = profile?.role === 'trabajador';
  const [records, setRecords] = useState<DiseaseReport[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DiseaseReport | null>(null);
  const [form, setForm] = useState({ animal_id: '', report_date: new Date().toISOString().slice(0, 10), symptoms: '', diagnosis: '', treatment: '', status: 'abierto', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await apiRequest<DiseaseReport[]>('/api/disease-reports/'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    apiRequest<Animal[]>('/api/animals/?active=true')
      .then(setAnimals)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudieron cargar los animales.'));
  }, [load]);
  useOfflineSyncRefresh(() => { void load(); });

  const openNew = () => {
    setEditing(null);
    setForm({ animal_id: animals[0]?.id ?? '', report_date: new Date().toISOString().slice(0, 10), symptoms: '', diagnosis: '', treatment: '', status: 'abierto', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (r: DiseaseReport) => {
    setEditing(r);
    setForm({ animal_id: r.animal_id, report_date: r.report_date, symptoms: r.symptoms, diagnosis: r.diagnosis ?? '', treatment: r.treatment ?? '', status: r.status, notes: r.notes ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      animal_id: form.animal_id,
      report_date: form.report_date,
      symptoms: form.symptoms.trim(),
      diagnosis: form.diagnosis.trim() || null,
      treatment: form.treatment.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    try {
      const path = editing ? `/api/disease-reports/${editing.id}/` : '/api/disease-reports/';
      await apiRequest(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el reporte.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setError(null);
    try {
      await apiRequest(`/api/disease-reports/${deleteId}/`, { method: 'DELETE' });
      setDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el reporte.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Reporte y seguimiento de enfermedades</p>
        <Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Nuevo reporte</span></Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState icon={<Stethoscope size={28} />} title="No hay reportes de enfermedades" action={<Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Reportar enfermedad</span></Button>} />
      ) : (
        <div className="mt-grid">
          {records.map((r) => (
            <div key={r.id} className="mt-card group hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                  <Stethoscope size={20} />
                </div>
                <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
              </div>
              <h3 className="font-semibold" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>{r.animal ? getAnimalDisplayName(r.animal) : 'Sin animal'}</h3>
              <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>{new Date(r.report_date).toLocaleDateString('es-CO')}</p>
              <div className="mt-2 space-y-1" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>
                <p><span className="font-medium">Síntomas:</span> {r.symptoms}</p>
                {r.diagnosis && <p><span className="font-medium">Diagnóstico:</span> {r.diagnosis}</p>}
                {r.treatment && <p><span className="font-medium">Tratamiento:</span> {r.treatment}</p>}
              </div>
              <div className={`mt-3 flex gap-1 ${isWorker ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                <button onClick={() => openEdit(r)} className="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium flex items-center justify-center gap-1"><Pencil size={13} /> Editar</button>
                {!isWorker && (
                  <button onClick={() => setDeleteId(r.id)} className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs"><Trash2 size={13} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar reporte' : 'Nuevo reporte de enfermedad'}>
        <div className="space-y-4">
          <Field label="Animal *">
            <AnimalPicker
              animals={animals}
              value={form.animal_id}
              onChange={(animal_id) => setForm({ ...form, animal_id })}
            />
            {animals.length === 0 && <span className="mt-1 block text-xs text-slate-500">No hay animales activos para elegir.</span>}
          </Field>
          <Field label="Fecha del reporte *">
            <TextInput type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} />
          </Field>
          <Field label="Síntomas *">
            <TextArea rows={2} value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} placeholder="Describe los síntomas..." />
          </Field>
          <Field label="Diagnóstico">
            <TextInput value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </Field>
          <Field label="Tratamiento">
            <TextInput value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DiseaseReport['status'] })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Observaciones">
            <TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.animal_id || !form.symptoms.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </Modal>

      {!isWorker && (
        <ConfirmDialog open={!!deleteId} title="Eliminar reporte" message="¿Seguro que deseas eliminar este reporte?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}
