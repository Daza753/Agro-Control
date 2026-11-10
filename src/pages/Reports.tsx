import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, Milk, Beef, Syringe, Pill, FlaskConical, Sprout, Fish, Wrench,
  Download, ClipboardList, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { apiRequest, getActiveFarmId } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { exportReportXlsx } from '../lib/reportExport';
import type { ReportDetailRecords, ReportExportData } from '../lib/reportExport';
import type {
  ActivitySubmission, Animal, Crop, Equipment, FishPond, Input, Medication,
  MilkProduction, Profile, Vaccine,
} from '../lib/types';
import { ANIMAL_SPECIES, canonicalAnimalSpecies } from '../lib/animalSpecies';
import { getAnimalDisplayName } from '../lib/animalDisplay';

type ReportData = ReportExportData;

interface WorkerActivityReport {
  count: number;
  page: number;
  page_size: number;
  results: ActivitySubmission[];
}

const SPECIES_LABELS = Object.fromEntries(ANIMAL_SPECIES.map(({ value, label }) => [value, label]));

function getSnapshotRecords<T>(resources: Record<string, unknown>, path: string): T[] {
  const rows = resources[path];
  if (!Array.isArray(rows)) throw new Error(`La copia de la finca no contiene todos los registros de ${path}.`);
  return rows as T[];
}

async function loadReportRecords(): Promise<ReportDetailRecords> {
  const farmId = getActiveFarmId();
  if (!farmId) throw new Error('Selecciona una finca antes de generar el reporte.');
  const snapshot = await apiRequest<{ farm_id: string; resources: Record<string, unknown> }>(
    '/api/sync/snapshot/',
    { headers: { 'X-Farm-ID': farmId } },
  );
  if (snapshot.farm_id !== farmId || !snapshot.resources) {
    throw new Error('La copia de los registros pertenece a otra finca o está incompleta. Sincroniza y vuelve a intentar.');
  }
  return {
    animals: getSnapshotRecords(snapshot.resources, '/api/animals/'),
    animalCategories: getSnapshotRecords(snapshot.resources, '/api/animal-categories/'),
    milkProduction: getSnapshotRecords(snapshot.resources, '/api/milk-production/'),
    vaccines: getSnapshotRecords(snapshot.resources, '/api/vaccines/'),
    medications: getSnapshotRecords(snapshot.resources, '/api/medications/'),
    inputs: getSnapshotRecords(snapshot.resources, '/api/inputs/'),
    equipment: getSnapshotRecords(snapshot.resources, '/api/equipment/'),
    crops: getSnapshotRecords(snapshot.resources, '/api/crops/'),
    fishPonds: getSnapshotRecords(snapshot.resources, '/api/fish-farming/'),
    activities: getSnapshotRecords(snapshot.resources, '/api/daily-activities/'),
    diseases: getSnapshotRecords(snapshot.resources, '/api/disease-reports/'),
  };
}

async function loadAssetBytes(fileName: string) {
  const assetDirectory = import.meta.env.DEV ? '/images/' : './images/';
  const response = await fetch(`${assetDirectory}${encodeURIComponent(fileName)}`);
  if (!response.ok) throw new Error(`No se pudo cargar el recurso de marca: ${fileName}.`);
  return new Uint8Array(await response.arrayBuffer());
}

export function Reports() {
  const { farms } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [workerReport, setWorkerReport] = useState<WorkerActivityReport | null>(null);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [workerReportLoading, setWorkerReportLoading] = useState(true);
  const [workerReportError, setWorkerReportError] = useState<string | null>(null);
  const [workerListError, setWorkerListError] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [workerPage, setWorkerPage] = useState(1);

  useEffect(() => {
    (async () => {
      const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

      try {
        const [milkRecords, animals, vaccines, medications, inputs, crops, ponds, equipment] = await Promise.all([
          apiRequest<MilkProduction[]>(`/api/milk-production/?date_from=${monthAgo}`),
          apiRequest<Animal[]>('/api/animals/?active=true'),
          apiRequest<Vaccine[]>('/api/vaccines/'),
          apiRequest<Medication[]>('/api/medications/'),
          apiRequest<Input[]>('/api/inputs/'),
          apiRequest<Crop[]>('/api/crops/'),
          apiRequest<FishPond[]>('/api/fish-farming/'),
          apiRequest<Equipment[]>('/api/equipment/'),
        ]);

        const milkTotal = milkRecords.reduce((sum, record) => sum + Number(record.total_liters ?? 0), 0);
        const speciesMap = new Map<string, number>();
        for (const animal of animals) {
          const species = canonicalAnimalSpecies(animal.species);
          speciesMap.set(species, (speciesMap.get(species) ?? 0) + 1);
        }
        const animalsBySpecies = Array.from(speciesMap.entries())
          .map(([species, count]) => ({ species, count }))
          .sort((a, b) => b.count - a.count);
        const equipmentMap = new Map<string, number>();
        for (const item of equipment) {
          equipmentMap.set(item.status, (equipmentMap.get(item.status) ?? 0) + 1);
        }

        setData({
          milkTotal,
          milkRecords: milkRecords.length,
          animalsBySpecies,
          pendingVaccines: vaccines.filter((vaccine) => vaccine.status === 'pendiente').length,
          appliedVaccines: vaccines.filter((vaccine) => vaccine.status === 'aplicada').length,
          medications,
          inputs,
          activeCrops: crops.filter((crop) => crop.status === 'activo').length,
          harvestedCrops: crops.filter((crop) => crop.status === 'cosechado').length,
          activePonds: ponds.filter((pond) => pond.status === 'activo').length,
          equipmentByStatus: Array.from(equipmentMap.entries()).map(([status, count]) => ({ status, count })),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadWorkerReport = useCallback(async () => {
    setWorkerReportLoading(true);
    setWorkerReportError(null);
    const params = new URLSearchParams({ page: String(workerPage) });
    if (workerId) params.set('worker_id', workerId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    try {
      setWorkerReport(await apiRequest<WorkerActivityReport>(
        `/api/reports/worker-activities/?${params.toString()}`,
      ));
    } catch (err) {
      setWorkerReportError(err instanceof Error
        ? err.message
        : 'No se pudieron cargar los datos enviados por los trabajadores.');
    } finally {
      setWorkerReportLoading(false);
    }
  }, [dateFrom, dateTo, workerId, workerPage]);
  useOfflineSyncRefresh(() => { void loadWorkerReport(); });

  useEffect(() => {
    let active = true;
    apiRequest<Profile[]>('/api/auth/users/')
      .then((profiles) => {
        if (!active) return;
        const farmId = getActiveFarmId();
        setWorkers(profiles.filter((profile) => (
          profile.role === 'trabajador' && profile.farm_id === farmId
        )));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setWorkerListError(err instanceof Error
          ? err.message
          : 'No se pudo cargar la lista de trabajadores.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void loadWorkerReport();
    const refresh = () => { void loadWorkerReport(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [loadWorkerReport]);

  const farmName = farms.find((farm) => farm.id === getActiveFarmId())?.name ?? 'Mi Finca';

  const loadLogoBase64 = async () => {
    const logoPath = import.meta.env.DEV ? '/images/logo.png' : './images/logo.png';
    const response = await fetch(logoPath);
    if (!response.ok) throw new Error('No se pudo cargar el logotipo.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return `data:image/png;base64,${btoa(binary)}`;
  };

  const exportExcel = async () => {
    if (!data) return;
    setExportingExcel(true);
    setExportError(null);
    setExportFeedback(null);
    let logoBase64: string | undefined;
    let logoUnavailable = false;
    try {
      try {
        logoBase64 = await loadLogoBase64();
      } catch (logoError) {
        console.warn('Se generará el reporte sin el logotipo.', logoError);
        logoUnavailable = true;
      }
      const records: ReportDetailRecords = await loadReportRecords();
      await exportReportXlsx(data, farmName, records, logoBase64);
      setExportFeedback(logoUnavailable
        ? 'El reporte Excel se descargó, pero no se pudo incluir el logotipo.'
        : 'El reporte Excel se descargó correctamente.');
    } catch (exportError) {
      setExportError(exportError instanceof Error ? exportError.message : 'No se pudo generar el reporte Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  const exportWord = async () => {
    if (!data) return;
    setExportError(null);
    setExportFeedback(null);
    setExportingReport(true);
    try {
      const [records, banner, header, footer, leftMargin, rightMargin] = await Promise.all([
        loadReportRecords(),
        loadAssetBytes('Banner agrícola con toro Nelore y paisaje tropical.png'),
        loadAssetBytes('encabezado_FincaControl_sin_bordes_blancos.png'),
        loadAssetBytes('Banner-pie de pagina FincaControl Verde y Dorado.png'),
        loadAssetBytes('margen_lateral_izquierdo_FincaControl_solo_margen.png'),
        loadAssetBytes('margen_derecho_FincaControl_sin_espacio_extra.png'),
      ]);
      const { exportReportWord } = await import('../lib/reportWord');
      await exportReportWord(data, farmName, records, {
        banner,
        header,
        footer,
        leftMargin,
        rightMargin,
      });
      setExportFeedback('El reporte Word completo se descargó correctamente.');
    } catch (exportError) {
      setExportError(exportError instanceof Error ? exportError.message : 'No se pudo generar el reporte Word.');
    } finally {
      setExportingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p role="alert" className="text-sm text-red-600">{error ?? 'No se pudo cargar el reporte.'}</p>;
  }

  const cards = [
    { icon: <Milk size={22} />, label: 'Producción de leche (30 días)', value: `${data!.milkTotal.toFixed(1)} L`, color: 'sky' },
    { icon: <Beef size={22} />, label: 'Total animales', value: data!.animalsBySpecies.reduce((s, a) => s + a.count, 0), color: 'emerald' },
    { icon: <Syringe size={22} />, label: 'Vacunas pendientes', value: data!.pendingVaccines, color: 'amber' },
    { icon: <Pill size={22} />, label: 'Medicamentos', value: data!.medications.length, color: 'red' },
    { icon: <FlaskConical size={22} />, label: 'Insumos agrícolas', value: data!.inputs.length, color: 'lime' },
    { icon: <Sprout size={22} />, label: 'Cultivos activos', value: data!.activeCrops, color: 'green' },
    { icon: <Fish size={22} />, label: 'Estanques activos', value: data!.activePonds, color: 'cyan' },
    { icon: <Wrench size={22} />, label: 'Equipos', value: data!.equipmentByStatus.reduce((s, e) => s + e.count, 0), color: 'gray' },
  ];

  const colorMap: Record<string, string> = {
    sky: 'from-sky-500 to-sky-600', emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600', red: 'from-red-500 to-red-600',
    lime: 'from-lime-500 to-lime-600', green: 'from-green-500 to-green-600',
    cyan: 'from-cyan-500 to-cyan-600', gray: 'from-slate-500 to-slate-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Resumen general del estado de la finca</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exportingExcel}
            className="mt-btn flex items-center gap-2 disabled:cursor-wait disabled:opacity-60"
            style={{ backgroundColor: 'var(--mt-accent)' }}
          >
            <Download size={18} />
            {exportingExcel ? 'Preparando Excel…' : 'Descargar Excel'}
          </button>
          <button
            type="button"
            onClick={() => void exportWord()}
            disabled={exportingReport}
            className="mt-btn flex items-center gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <Download size={18} /> {exportingReport ? 'Preparando reporte…' : 'Descargar reporte'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}
      {exportFeedback && <p role="status" className="text-sm text-emerald-700">{exportFeedback}</p>}
      <div className="mt-grid">
        {cards.map((c) => (
          <div key={c.label} className="mt-card">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[c.color]} flex items-center justify-center text-white shadow-lg mb-3`}>
              {c.icon}
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--mt-heading-color)' }}>{c.value}</p>
            <p className="mt-0.5" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>
              <ClipboardList size={19} style={{ color: 'var(--mt-accent)' }} />
              Datos cargados por trabajadores
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--mt-text-color)' }}>
              Registro exacto de actividades creadas, editadas o eliminadas. Se actualiza automáticamente.
            </p>
          </div>
          {workerReport && (
            <span className="text-sm" style={{ color: 'var(--mt-text-color)' }}>
              {workerReport.count} registro(s)
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-600">
            Trabajador
            <select
              value={workerId}
              onChange={(event) => {
                setWorkerId(event.target.value);
                setWorkerPage(1);
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800"
            >
              <option value="">Todos los trabajadores</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.full_name || worker.email}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-600">
            Cargado desde
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setWorkerPage(1);
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800"
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Cargado hasta
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setWorkerPage(1);
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800"
            />
          </label>
        </div>

        {(workerReportError || workerListError) && (
          <p role="alert" className="text-sm text-red-600">{workerReportError ?? workerListError}</p>
        )}
        {workerReportLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
          </div>
        ) : workerReport?.results.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Trabajador / carga</th>
                    <th className="px-3 py-2">Acción</th>
                    <th className="px-3 py-2">Fecha de actividad</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Animal</th>
                    <th className="px-3 py-2">Descripción exacta</th>
                    <th className="px-3 py-2">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {workerReport.results.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800">{entry.worker.full_name || 'Trabajador'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {new Date(entry.created_at).toLocaleString('es-CO')}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {entry.action === 'created' ? 'Creado' : entry.action === 'updated' ? 'Editado' : 'Eliminado'}
                      </td>
                      <td className="px-3 py-3">
                        {new Date(`${entry.data.date}T12:00:00`).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-3 py-3">{entry.data.activity_type}</td>
                      <td className="px-3 py-3">
                        {entry.data.animal
                          ? getAnimalDisplayName(entry.data.animal)
                          : entry.data.animal_id ? 'Animal no disponible' : '—'}
                      </td>
                      <td className="max-w-xs whitespace-pre-wrap px-3 py-3">{entry.data.description}</td>
                      <td className="max-w-xs whitespace-pre-wrap px-3 py-3">{entry.data.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Página {workerReport.page} de {Math.max(1, Math.ceil(workerReport.count / workerReport.page_size))}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={workerReport.page <= 1}
                  onClick={() => setWorkerPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Página siguiente"
                  disabled={workerReport.page * workerReport.page_size >= workerReport.count}
                  onClick={() => setWorkerPage((page) => page + 1)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--mt-text-color)' }}>
            No hay datos de trabajadores para los filtros seleccionados.
          </p>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="mt-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}><BarChart3 size={18} style={{ color: 'var(--mt-accent)' }} /> Inventario por especie</h3>
          <div className="space-y-3">
            {data!.animalsBySpecies.map((s) => {
              const total = data!.animalsBySpecies.reduce((sum, x) => sum + x.count, 0) || 1;
              const pct = (s.count / total) * 100;
              return (
                <div key={s.species}>
                  <div className="flex justify-between mb-1" style={{ fontSize: 'var(--mt-text-size)' }}>
                    <span style={{ color: 'var(--mt-text-color)' }}>{SPECIES_LABELS[s.species] ?? s.species}</span>
                    <span className="font-semibold" style={{ color: 'var(--mt-heading-color)' }}>{s.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}><Syringe size={18} className="text-amber-600" /> Estado de vacunas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-amber-700">{data!.pendingVaccines}</p>
              <p className="text-sm text-amber-600 mt-1">Pendientes</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-emerald-700">{data!.appliedVaccines}</p>
              <p className="text-sm text-emerald-600 mt-1">Aplicadas</p>
            </div>
          </div>
        </div>

        <div className="mt-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}><Pill size={18} className="text-red-600" /> Inventario de medicamentos</h3>
          {data!.medications.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data!.medications.map((m, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0" style={{ fontSize: 'var(--mt-text-size)' }}>
                  <span style={{ color: 'var(--mt-heading-color)' }}>{m.name}</span>
                  <span style={{ color: 'var(--mt-text-color)' }}>{m.quantity} {m.unit}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center py-4" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Sin medicamentos</p>}
        </div>

        <div className="mt-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}><FlaskConical size={18} className="text-lime-600" /> Inventario de insumos</h3>
          {data!.inputs.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data!.inputs.map((m, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0" style={{ fontSize: 'var(--mt-text-size)' }}>
                  <span style={{ color: 'var(--mt-heading-color)' }}>{m.name}</span>
                  <span style={{ color: 'var(--mt-text-color)' }}>{m.quantity} {m.unit}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center py-4" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Sin insumos</p>}
        </div>
      </div>
    </div>
  );
}
