import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Syringe, Bell, CheckCircle, AlertCircle } from 'lucide-react';
import type { Animal, Vaccine } from '../lib/types';
import { apiRequest } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { Modal, Field, TextInput, Select, TextArea, Button, Badge, EmptyState, ConfirmDialog } from '../components/ui';
import { AnimalPicker } from '../components/AnimalPicker';
import { getAnimalDisplayName } from '../lib/animalDisplay';
import { useAuth } from '../lib/auth';

const STATUS_LABELS: Record<string, string> = { pendiente: 'Pendiente', aplicada: 'Aplicada', vencida: 'Vencida' };
const STATUS_COLORS: Record<string, 'yellow' | 'green' | 'red'> = { pendiente: 'yellow', aplicada: 'green', vencida: 'red' };

interface MedicationOption {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  dose: string | null;
}

export function Vaccines() {
  const { profile } = useAuth();
  const isWorker = profile?.role === 'trabajador';
  const [records, setRecords] = useState<Vaccine[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [vaccineNames, setVaccineNames] = useState<string[]>([]);
  const [medications, setMedications] = useState<MedicationOption[]>([]);
  const [medicationError, setMedicationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vaccine | null>(null);
  const [form, setForm] = useState({ animal_id: '', vaccine_name: '', scheduled_date: new Date().toISOString().slice(0, 10), applied_date: '', medication_id: '', dose: '', status: 'pendiente', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pendiente' | 'aplicada' | 'vencida' | 'proximas'>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let rows = await apiRequest<Vaccine[]>('/api/vaccines/');
      setVaccineNames(Array.from(new Map(
        rows
          .map((row) => row.vaccine_name.trim())
          .filter(Boolean)
          .map((name) => [name.toLocaleLowerCase(), name]),
      ).values()).sort((first, second) => first.localeCompare(second, 'es')));
      const today = new Date();
      const in7 = new Date(today.getTime() + 7 * 86400000);
      if (filter === 'proximas') {
        rows = rows.filter((r) => r.status === 'pendiente' && new Date(r.scheduled_date) <= in7);
      } else if (filter !== 'all') {
        rows = rows.filter((r) => r.status === filter);
      }
      setRecords(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las vacunas.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadAnimals = useCallback(async () => {
    try {
      setAnimals(await apiRequest<Animal[]>('/api/animals/?active=true'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los animales.');
    }
  }, []);

  const loadMedications = useCallback(async () => {
    try {
      setMedications(await apiRequest<MedicationOption[]>('/api/vaccines/medication-options/'));
      setMedicationError(null);
    } catch (err) {
      setMedicationError(err instanceof Error
        ? err.message
        : 'No se pudo cargar el inventario de medicamentos.');
    }
  }, []);

  const refreshAfterSync = useCallback(() => {
    void load();
    void loadMedications();
  }, [load, loadMedications]);

  useEffect(() => { load(); }, [load]);
  useOfflineSyncRefresh(refreshAfterSync);
  useEffect(() => { loadAnimals(); }, [loadAnimals]);
  useEffect(() => { loadMedications(); }, [loadMedications]);

  const openNew = () => {
    setEditing(null);
    setForm({ animal_id: animals[0]?.id ?? '', vaccine_name: '', scheduled_date: new Date().toISOString().slice(0, 10), applied_date: '', medication_id: '', dose: '', status: 'pendiente', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (r: Vaccine) => {
    setEditing(r);
    setForm({
      animal_id: r.animal_id ?? '', vaccine_name: r.vaccine_name, scheduled_date: r.scheduled_date,
      applied_date: r.applied_date ?? '',
      medication_id: r.medication_id ?? (r.medication ? 'legacy' : ''),
      dose: r.dose ?? '',
      status: r.status, notes: r.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const selectedMedication = medications.find((medication) => medication.id === form.medication_id);
    const payload = {
      animal_id: form.animal_id || null,
      vaccine_name: form.vaccine_name.trim(),
      scheduled_date: form.scheduled_date,
      applied_date: form.applied_date || null,
      ...(form.medication_id !== 'legacy' && {
        medication_id: form.medication_id || null,
        medication: selectedMedication?.name ?? null,
      }),
      dose: form.dose.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    try {
      const path = editing ? `/api/vaccines/${editing.id}/` : '/api/vaccines/';
      await apiRequest(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la vacuna.');
    } finally {
      setSaving(false);
    }
  };

  const markApplied = async (r: Vaccine) => {
    setError(null);
    try {
      await apiRequest(`/api/vaccines/${r.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'aplicada', applied_date: new Date().toISOString().slice(0, 10) }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la vacuna.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setError(null);
    try {
      await apiRequest(`/api/vaccines/${deleteId}/`, { method: 'DELETE' });
      setDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la vacuna.');
    }
  };

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const upcoming = records.filter((r) => r.status === 'pendiente' && new Date(r.scheduled_date) <= in7);
  const legacyMedication = editing?.medication_id
    ? medications.some((medication) => medication.id === editing.medication_id)
      ? null
      : editing.medication
    : editing?.medication;

  return (
    <div className="space-y-5">
      {/* Alert */}
      {upcoming.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
            <Bell size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Vacunas próximas en 7 días</p>
            <p className="text-xs text-amber-700">{upcoming.length} vacuna(s) pendiente(s) por aplicar</p>
          </div>
          <button onClick={() => setFilter('proximas')} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700">
            Ver próximas
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'pendiente', 'proximas', 'aplicada', 'vencida'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f ? 'text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              style={filter === f ? { backgroundColor: 'var(--mt-accent)' } : undefined}
            >
              {f === 'all' ? 'Todas' : f === 'proximas' ? 'Próximas' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Programar vacuna</span></Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Syringe size={28} />}
          title="No hay vacunas programadas"
          description="Programa la primera vacuna del calendario."
          action={<Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Programar vacuna</span></Button>}
        />
      ) : (
        <div className="mt-grid">
          {records.map((r) => {
            const daysLeft = Math.ceil((new Date(r.scheduled_date).getTime() - today.getTime()) / 86400000);
            const isUrgent = r.status === 'pendiente' && daysLeft <= 7;
            return (
              <div key={r.id} className={`mt-card mt-card-hover group ${isUrgent ? 'border-amber-300' : ''}`} style={isUrgent ? { borderColor: undefined } : undefined}>
                <div className="flex items-start justify-between mb-3">
                  <div className="mt-icon-tile" style={{ backgroundColor: 'var(--mt-accent)', color: 'white' }}>
                    <Syringe size={20} />
                  </div>
                  <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </div>
                <h3 className="font-semibold" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>{r.vaccine_name}</h3>
                <p className="text-sm mt-0.5" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>
                  {r.animal ? getAnimalDisplayName(r.animal) : 'Sin animal específico'}
                </p>
                <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--mt-text-color)' }}>
                  <p>Programada: {new Date(r.scheduled_date).toLocaleDateString('es-CO')}</p>
                  {r.applied_date && <p>Aplicada: {new Date(r.applied_date).toLocaleDateString('es-CO')}</p>}
                  {r.medication && <p>Medicamento del inventario: {r.medication}</p>}
                  {r.dose && <p>Dosis: {r.dose}</p>}
                </div>
                {isUrgent && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                    <AlertCircle size={14} />
                    {daysLeft < 0 ? `Vencida hace ${Math.abs(daysLeft)} día(s)` : daysLeft === 0 ? 'Vence hoy' : `En ${daysLeft} día(s)`}
                  </div>
                )}
                <div className={`mt-3 flex gap-1.5 ${isWorker ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  {r.status === 'pendiente' && (
                    <button onClick={() => markApplied(r)} className="flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ backgroundColor: 'var(--mt-accent)', color: 'white' }}>
                      <CheckCircle size={13} /> Aplicar
                    </button>
                  )}
                  <button onClick={() => openEdit(r)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs"><Pencil size={13} /></button>
                  {!isWorker && (
                    <button onClick={() => setDeleteId(r.id)} className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar vacuna' : 'Programar vacuna'}>
        <div className="space-y-4">
          <Field label="Animal">
            <AnimalPicker
              animals={animals}
              value={form.animal_id}
              onChange={(animal_id) => setForm({ ...form, animal_id })}
              allowEmpty
              emptyLabel="Sin animal específico"
            />
          </Field>
          <Field label="Vacuna *">
            <>
              <TextInput
                list="registered-vaccine-names"
                value={form.vaccine_name}
                onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })}
                placeholder={vaccineNames.length ? 'Elige una vacuna o escribe otra' : 'Escribe el nombre de la vacuna'}
              />
              <datalist id="registered-vaccine-names">
                {vaccineNames.map((name) => <option key={name} value={name} />)}
              </datalist>
              <span className="mt-1 block text-xs text-slate-500">
                Puedes elegir una vacuna registrada anteriormente o escribir una nueva.
              </span>
            </>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha programada *">
              <TextInput type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </Field>
            <Field label="Fecha aplicada">
              <TextInput type="date" value={form.applied_date} onChange={(e) => setForm({ ...form, applied_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Medicamento del inventario">
              <Select
                value={form.medication_id}
                onChange={(e) => setForm({ ...form, medication_id: e.target.value })}
              >
                <option value="">Sin medicamento asociado</option>
                {legacyMedication && (
                  <option value="legacy">{legacyMedication} (registro anterior)</option>
                )}
                {medications.map((medication) => (
                  <option key={medication.id} value={medication.id}>
                    {medication.name} · {medication.quantity} {medication.unit}
                  </option>
                ))}
              </Select>
              {medicationError && (
                <span role="alert" className="mt-1 block text-xs text-amber-700">
                  No se pudo cargar la lista de medicamentos: {medicationError}
                </span>
              )}
              {medications.length === 0 && !medicationError && (
                <span className="mt-1 block text-xs text-slate-500">
                  No hay medicamentos en el inventario. Puedes guardar la vacuna sin asociar uno.
                </span>
              )}
            </Field>
            <Field label="Dosis">
              <TextInput value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />
            </Field>
          </div>
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vaccine['status'] })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Observaciones">
            <TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.vaccine_name.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </Modal>

      {!isWorker && (
        <ConfirmDialog
          open={!!deleteId}
          title="Eliminar vacuna"
          message="¿Seguro que deseas eliminar esta vacuna?"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
