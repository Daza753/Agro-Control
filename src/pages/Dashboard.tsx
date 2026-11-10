import {
  Beef, Milk, Syringe, Sprout, Fish, TrendingUp, AlertCircle,
  Pill, Package, Wrench, Activity, Stethoscope,
} from 'lucide-react';
import { useDashboardStats } from '../lib/hooks';
import type { Profile } from '../lib/auth';
import { PageKey } from '../components/Layout';
import { useModuleAccess } from '../lib/moduleAccess';
import { useAuth } from '../lib/auth';
import { getActiveFarmId, setActiveFarmId } from '../lib/api';
import { ANIMAL_SPECIES } from '../lib/animalSpecies';

const SPECIES_LABELS = Object.fromEntries(ANIMAL_SPECIES.map(({ value, label }) => [value, label]));
const SPECIES_ICONS = Object.fromEntries(ANIMAL_SPECIES.map(({ value, icon }) => [value, icon]));

const CATEGORY_LABELS: Record<string, string> = {
  VA: 'Vacas', NV: 'Novillas', NO: 'Novillos', TR: 'Terneras', TE: 'Terneros',
  TT: 'Toretes', TO: 'Toros',
  EQ: 'Equinos', PO: 'Potros', YE: 'Yeguas',
  CH: 'Chivos', CA: 'Cabras', CE: 'Cerdos', OV: 'Ovejas', CO: 'Corderos',
};
const CATEGORY_COLORS: Record<string, string> = {
  VA: 'bg-emerald-500', NV: 'bg-sky-500', NO: 'bg-indigo-500', TR: 'bg-amber-500',
  TE: 'bg-orange-500', TT: 'bg-red-500', TO: 'bg-rose-600',
  EQ: 'bg-violet-500', PO: 'bg-purple-500', YE: 'bg-fuchsia-500',
  CH: 'bg-lime-500', CA: 'bg-green-500', CE: 'bg-orange-600', OV: 'bg-teal-500', CO: 'bg-cyan-500',
};

interface DashboardProps {
  profile: Profile;
  onNavigate: (page: PageKey) => void;
}

export function Dashboard({ profile, onNavigate }: DashboardProps) {
  const { farms } = useAuth();
  const { isModuleEnabled, loading: accessLoading } = useModuleAccess();
  const isAdmin = profile.role === 'admin';
  const { stats, loading, error } = useDashboardStats({
    animals: isModuleEnabled('animals'),
    milk: isModuleEnabled('milk'),
    vaccines: isModuleEnabled('vaccines'),
    crops: isModuleEnabled('crops'),
    fish: isModuleEnabled('fish'),
  }, !accessLoading, isAdmin);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    const workerModules = [
      { page: 'animals' as PageKey, label: 'Animales', description: 'Consulta y registra el ganado.', icon: <Beef size={24} /> },
      { page: 'milk' as PageKey, label: 'Producción de leche', description: 'Registra los ordeños del día.', icon: <Milk size={24} /> },
      { page: 'vaccines' as PageKey, label: 'Vacunas', description: 'Consulta y registra vacunaciones.', icon: <Syringe size={24} /> },
      { page: 'medications' as PageKey, label: 'Medicamentos', description: 'Revisa y actualiza medicamentos.', icon: <Pill size={24} /> },
      { page: 'inputs' as PageKey, label: 'Insumos', description: 'Consulta y registra insumos.', icon: <Package size={24} /> },
      { page: 'equipment' as PageKey, label: 'Equipos', description: 'Consulta y actualiza equipos.', icon: <Wrench size={24} /> },
      { page: 'crops' as PageKey, label: 'Cultivos', description: 'Consulta y registra cultivos.', icon: <Sprout size={24} /> },
      { page: 'fish' as PageKey, label: 'Piscicultura', description: 'Consulta y registra estanques.', icon: <Fish size={24} /> },
      { page: 'activities' as PageKey, label: 'Carga de datos', description: 'Sube el trabajo realizado, incluso sin internet.', icon: <Activity size={24} /> },
      { page: 'diseases' as PageKey, label: 'Enfermedades', description: 'Consulta y registra novedades sanitarias.', icon: <Stethoscope size={24} /> },
    ].filter((module) => isModuleEnabled(module.page));

    return (
      <div className="mx-auto w-full max-w-6xl">
        {workerModules.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workerModules.map((module) => (
              <button
                key={module.page}
                type="button"
                onClick={() => onNavigate(module.page)}
                className="mt-card group flex min-h-44 flex-col items-start text-left transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: 'var(--mt-accent)' }}
                >
                  {module.icon}
                </span>
                <span className="text-base font-semibold" style={{ color: 'var(--mt-heading-color)' }}>
                  {module.label}
                </span>
                <span className="mt-1 text-sm" style={{ color: 'var(--mt-text-color)' }}>
                  {module.description}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-card text-center text-sm" style={{ color: 'var(--mt-text-color)' }}>
            No tienes módulos habilitados. Comunícate con el administrador de la finca.
          </div>
        )}
      </div>
    );
  }

  const allCards = [
    { label: 'Animales', value: stats?.totalAnimals ?? 0, icon: <Beef size={22} />, color: 'emerald', page: 'animals' as PageKey, suffix: '' },
    { label: 'Producción hoy', value: stats?.milkToday ?? 0, icon: <Milk size={22} />, color: 'sky', page: 'milk' as PageKey, suffix: ' L' },
    { label: 'Vacunas pendientes', value: stats?.pendingVaccines ?? 0, icon: <Syringe size={22} />, color: 'amber', page: 'vaccines' as PageKey, suffix: '' },
    { label: 'Cultivos activos', value: stats?.activeCrops ?? 0, icon: <Sprout size={22} />, color: 'lime', page: 'crops' as PageKey, suffix: '' },
    { label: 'Piscicultura', value: stats?.activePonds ?? 0, icon: <Fish size={22} />, color: 'cyan', page: 'fish' as PageKey, suffix: ' estanques' },
  ];
  const cards = allCards.filter((c) => isModuleEnabled(c.page));
  const maxMilk = Math.max(...(stats?.recentMilk.map((d) => d.total) ?? [1]), 1);

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={16} /> No se pudo cargar el resumen: {error}
        </p>
      )}
      {/* Welcome banner */}
      <div className="mt-card relative overflow-hidden" style={{ backgroundColor: 'var(--mt-accent)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
          <div className="min-w-0">
            <p className="text-white/80 text-sm font-medium">Bienvenido,</p>
            <h2 className="text-2xl lg:text-3xl font-bold text-white mt-1">
              {profile.full_name || 'Usuario'}
            </h2>
            <div
              className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-xs font-medium capitalize"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              Rol: {profile.role}
            </div>
          </div>
        </div>
      </div>

      {profile.role === 'admin' && farms.length > 0 && (
        <section className="mt-card space-y-4">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--mt-heading-color)' }}>
              Mis fincas
            </h3>
            <p className="text-sm" style={{ color: 'var(--mt-text-color)' }}>
              Elige una finca para entrar a su información.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {farms.map((farm) => {
              const isActive = farm.id === getActiveFarmId();
              return (
                <button
                  key={farm.id}
                  type="button"
                  onClick={() => {
                    setActiveFarmId(farm.id);
                    window.location.reload();
                  }}
                  className={`overflow-hidden rounded-xl border text-left transition hover:shadow-md ${
                    isActive ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="flex h-36 items-center justify-center bg-slate-100">
                    {farm.logo_url ? (
                      <img
                        src={farm.logo_url}
                        alt={`Foto de ${farm.name}`}
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <Sprout size={38} className="text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    <span className="block truncate font-semibold" style={{ color: 'var(--mt-heading-color)' }}>
                      {farm.name}
                    </span>
                    <span className={`block text-xs font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {isActive ? 'Seleccionada' : 'Seleccionar finca'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('farms')}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Administrar fincas
          </button>
        </section>
      )}

      {/* Stat cards */}
      <div className="mt-grid">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => onNavigate(c.page)}
            className="group mt-card mt-card-hover text-left"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg mb-3 group-hover:scale-110 transition-transform"
              style={{ backgroundColor: 'var(--mt-accent)' }}
            >
              {c.icon}
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--mt-heading-color)' }}>
              {c.value}
              <span className="text-sm font-normal" style={{ color: 'var(--mt-text-color)' }}>{c.suffix}</span>
            </p>
            <p className="text-sm mt-0.5" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>{c.label}</p>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly milk chart */}
        <div className="mt-card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold flex items-center gap-2" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>
              <TrendingUp size={18} style={{ color: 'var(--mt-accent)' }} />
              Producción de leche (7 días)
            </h3>
          </div>
          {stats && stats.recentMilk.length > 0 ? (
            <div className="flex items-end justify-between gap-2 h-48">
              {stats.recentMilk.map((d) => {
                const h = Math.max((d.total / maxMilk) * 100, 4);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-lg transition-all group relative"
                        style={{ height: `${h}%`, backgroundColor: 'var(--mt-accent)' }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap" style={{ color: 'var(--mt-heading-color)' }}>
                          {d.total} L
                        </span>
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--mt-text-color)' }}>
                      {new Date(d.date).toLocaleDateString('es-CO', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--mt-text-color)' }}>
              No hay registros de producción esta semana
            </div>
          )}
        </div>

        {/* Cattle breakdown by category */}
        <div className="mt-card">
          <h3 className="font-semibold mb-5" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>Ganado por categoría</h3>
          <div className="space-y-3">
            {stats && stats.cattleBreakdown.length > 0 ? (
              stats.cattleBreakdown.map((c) => {
                const total = stats.cattleBreakdown.reduce((s, x) => s + x.count, 0) || 1;
                const pct = (c.count / total) * 100;
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--mt-text-color)' }}>{CATEGORY_LABELS[c.category] ?? c.category}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--mt-heading-color)' }}>{c.count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--mt-card-border)' }}>
                      <div
                        className={`h-full ${CATEGORY_COLORS[c.category] ?? 'bg-slate-400'} rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-center py-8" style={{ color: 'var(--mt-text-color)' }}>Sin ganado registrado</p>
            )}
          </div>
        </div>
      </div>

      {/* Species breakdown */}
      <div className="mt-card">
        <h3 className="font-semibold mb-5" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>Inventario por especie</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats && stats.speciesBreakdown.length > 0 ? (
            stats.speciesBreakdown.map((s) => (
              <div key={s.species} className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--mt-card-bg)' }}>
                <div className="text-3xl mb-1">{SPECIES_ICONS[s.species] ?? '🐾'}</div>
                <p className="text-2xl font-bold" style={{ color: 'var(--mt-heading-color)' }}>{s.count}</p>
                <p className="text-xs" style={{ color: 'var(--mt-text-color)' }}>{SPECIES_LABELS[s.species] ?? s.species}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-center py-8 col-span-full" style={{ color: 'var(--mt-text-color)' }}>Sin animales registrados</p>
          )}
        </div>
      </div>

      {/* Vaccine alert */}
      {stats && stats.pendingVaccines > 0 && (
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ backgroundColor: 'var(--mt-card-bg)', border: '1px solid var(--mt-card-border)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: 'var(--mt-accent)' }}
          >
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--mt-heading-color)' }}>Vacunas próximas a vencer</p>
            <p className="text-sm" style={{ color: 'var(--mt-text-color)' }}>
              Tienes {stats.pendingVaccines} vacuna(s) pendiente(s). Revisa el calendario de vacunación.
            </p>
          </div>
          <button
            onClick={() => onNavigate('vaccines')}
            className="mt-btn"
            style={{ backgroundColor: 'var(--mt-accent)', color: '#fff' }}
          >
            Ver vacunas
          </button>
        </div>
      )}
    </div>
  );
}
