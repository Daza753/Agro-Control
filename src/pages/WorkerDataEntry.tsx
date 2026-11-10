import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Activity, CheckCircle2, ClipboardList, CloudOff } from 'lucide-react';
import { Button, EmptyState, Field, Select, TextArea, TextInput } from '../components/ui';
import { apiRequest } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { Animal, DailyActivity } from '../lib/types';
import { AnimalPicker } from '../components/AnimalPicker';
import { getAnimalDisplayName } from '../lib/animalDisplay';

const TYPE_LABELS: Record<DailyActivity['activity_type'], string> = {
  ordeno: 'Ordeño',
  alimentacion: 'Alimentación',
  nacimiento: 'Nacimiento',
  consulta_animal: 'Consulta de animal',
  reporte_enfermedad: 'Reporte de enfermedad',
  otro: 'Otro',
};

export function WorkerDataEntry() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<DailyActivity[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animalError, setAnimalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    activity_type: 'ordeno' as DailyActivity['activity_type'],
    animal_id: '',
    description: '',
    notes: '',
  });

  const load = useCallback(async () => {
    const [activityResult, animalResult] = await Promise.allSettled([
      apiRequest<DailyActivity[]>('/api/daily-activities/'),
      apiRequest<Animal[]>('/api/animals/?active=true'),
    ]);

    if (activityResult.status === 'fulfilled') {
      setRecords(activityResult.value);
      setError(null);
    } else {
      setError(activityResult.reason instanceof Error
        ? activityResult.reason.message
        : 'No se pudieron cargar las actividades.');
    }

    if (animalResult.status === 'fulfilled') {
      setAnimals(animalResult.value);
      setAnimalError(null);
    } else {
      setAnimalError(animalResult.reason instanceof Error
        ? animalResult.reason.message
        : 'No se pudo cargar la lista de animales.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('finca-offline-change', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('finca-offline-change', refresh);
    };
  }, [load]);
  useOfflineSyncRefresh(() => { void load(); });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await apiRequest<DailyActivity>('/api/daily-activities/', {
        method: 'POST',
        body: JSON.stringify({
          date: form.date,
          activity_type: form.activity_type,
          animal_id: form.animal_id || null,
          description: form.description.trim(),
          notes: form.notes.trim() || null,
        }),
      });
      setSuccess(saved.__offlineQueued
        ? 'Guardado en este dispositivo. Se enviará a la finca cuando vuelva la conexión.'
        : 'Dato enviado a la finca y disponible para sus miembros.');
      setForm({
        date: new Date().toISOString().slice(0, 10),
        activity_type: 'ordeno',
        animal_id: '',
        description: '',
        notes: '',
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el dato.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--mt-heading-color)' }}>
          Carga de datos del trabajador
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--mt-text-color)' }}>
          Registra lo realizado en la finca. Si no hay internet, el dato queda guardado en este dispositivo
          y se sincroniza automáticamente al reconectar.
        </p>
      </div>

      <form className="mt-card space-y-4" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de la actividad *">
            <TextInput
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
            />
          </Field>
          <Field label="Tipo de actividad *">
            <Select
              value={form.activity_type}
              onChange={(event) => setForm({
                ...form,
                activity_type: event.target.value as DailyActivity['activity_type'],
              })}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Animal relacionado">
          <AnimalPicker
            animals={animals}
            value={form.animal_id}
            onChange={(animal_id) => setForm({ ...form, animal_id })}
            allowEmpty
          />
          {animalError && <span role="alert" className="mt-1 block text-xs text-amber-700">{animalError}</span>}
        </Field>
        <Field label="Describe el dato o trabajo realizado *">
          <TextArea
            rows={4}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Describe qué se hizo o qué ocurrió..."
            required
          />
        </Field>
        <Field label="Observaciones">
          <TextArea
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Dato adicional (opcional)"
          />
        </Field>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {success && (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {success.startsWith('Guardado')
              ? <CloudOff size={18} className="mt-0.5 flex-shrink-0" />
              : <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />}
            {success}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !form.date || !form.description.trim()}>
            {saving ? 'Guardando…' : 'Guardar dato'}
          </Button>
        </div>
      </form>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--mt-heading-color)' }}>
          <ClipboardList size={20} /> Actividades recientes de la finca
        </h3>
        {error && records.length === 0 && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
          </div>
        ) : records.length === 0 ? (
          <EmptyState icon={<Activity size={28} />} title="Todavía no hay datos cargados" />
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <article key={record.id} className="mt-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--mt-heading-color)' }}>
                    {TYPE_LABELS[record.activity_type] ?? record.activity_type}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    record.__offlineQueued
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {record.__offlineQueued ? 'Pendiente de sincronizar' : 'Enviado'}
                  </span>
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--mt-text-color)' }}>{record.description}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Fecha: {new Date(`${record.date}T12:00:00`).toLocaleDateString('es-CO')}</span>
                  <span>Trabajador: {record.worker?.full_name ?? profile?.full_name ?? 'Pendiente de sincronizar'}</span>
                  {record.animal && <span>Animal: {getAnimalDisplayName(record.animal)}</span>}
                  {record.created_at && (
                    <span>Cargado: {new Date(record.created_at).toLocaleString('es-CO')}</span>
                  )}
                </div>
                {record.notes && <p className="mt-2 text-xs italic text-slate-500">{record.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
