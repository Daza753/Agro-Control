import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Beef, Filter, Tag, ChevronDown } from 'lucide-react';
import type { Animal } from '../lib/types';
import { useAuth } from '../lib/auth';
import { apiRequest } from '../lib/api';
import { useOfflineSyncRefresh } from '../lib/hooks';
import { Modal, Field, TextInput, Select, TextArea, Button, Badge, EmptyState, ConfirmDialog } from '../components/ui';
import { ANIMAL_SPECIES, canonicalAnimalSpecies, getBreedSuggestions, isSexCategory } from '../lib/animalSpecies';

const SPECIES_LABELS = Object.fromEntries(ANIMAL_SPECIES.map(({ value, label }) => [value, label]));
const SPECIES_ICONS = Object.fromEntries(ANIMAL_SPECIES.map(({ value, icon }) => [value, icon]));
const HEALTH_LABELS: Record<string, string> = {
  sano: 'Sano', enfermo: 'Enfermo', en_tratamiento: 'En tratamiento', fallecido: 'Fallecido',
};
const HEALTH_COLORS: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = {
  sano: 'green', enfermo: 'red', en_tratamiento: 'yellow', fallecido: 'gray',
};
const LACTATION_LABELS: Record<string, string> = { llenando: 'Llenando', parida: 'Parida' };
const LACTATION_COLORS: Record<string, 'amber' | 'green'> = { llenando: 'amber', parida: 'green' };
const CATEGORY_COLORS = ['#64748b', '#059669', '#0284c7', '#7c3aed', '#d97706', '#db2777'];

function makeCategoryCode(label: string, species: string, categories: AnimalCategory[]) {
  const base = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'CAT';
  let code = base;
  let suffix = 2;
  while (categories.some((category) => category.code === code && category.species === species)) {
    code = `${base.slice(0, 40 - String(suffix).length)}${suffix}`;
    suffix += 1;
  }
  return code;
}

interface AnimalCategory {
  id: string;
  code: string;
  label: string;
  species: string;
  color: string;
  is_default: boolean;
}

interface FormState {
  ica_code: string;
  name: string;
  species: string;
  category: string;
  breed: string;
  sex: 'macho' | 'hembra';
  birth_date: string;
  weight_kg: string;
  health_status: Animal['health_status'];
  lactation_status: string;
  notes: string;
}

const EMPTY: FormState = {
  ica_code: '', name: '', species: 'bovino', category: '', breed: '',
  sex: 'hembra', birth_date: '', weight_kg: '', health_status: 'sano', lactation_status: '', notes: '',
};

export function Animals() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [categories, setCategories] = useState<AnimalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Animal | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ label: '', species: 'all' });
  const [catDeleteId, setCatDeleteId] = useState<string | null>(null);
  const [breedMenuOpen, setBreedMenuOpen] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiRequest<AnimalCategory[]>('/api/animal-categories/');
      setCategories(data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudieron cargar las categorías.');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const params = new URLSearchParams();
    if (speciesFilter !== 'all') params.set('species', speciesFilter);
    if (search.trim()) params.set('search', search.trim());
    try {
      const query = params.size ? `?${params.toString()}` : '';
      setAnimals(await apiRequest<Animal[]>(`/api/animals/${query}`));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudieron cargar los animales.');
    } finally {
      setLoading(false);
    }
  }, [search, speciesFilter]);

  useEffect(() => { load(); }, [load]);
  useOfflineSyncRefresh(() => { void load(); });
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const catLabel = (code: string) => categoryLabel(code);
  const catColor = (code: string) => categories.find((c) => c.code === code)?.color ?? '#64748b';

  const grouped = new Map<string, Animal[]>();
  for (const a of animals) {
    const species = canonicalAnimalSpecies(a.species);
    if (!grouped.has(species)) grouped.set(species, []);
    grouped.get(species)!.push(a);
  }

  const getAutoCategory = (sex: 'macho' | 'hembra', weightKg: number | null): string | null => {
    if (!weightKg) return null;
    if (sex === 'macho') {
      if (weightKg <= 190) return 'TE';
      if (weightKg <= 290) return 'NO';
      if (weightKg <= 390) return 'TT';
      return 'TO';
    } else {
      if (weightKg <= 190) return 'TR';
      if (weightKg <= 290) return 'NV';
      return 'VA';
    }
  };

  const categoryStats = new Map<string, number>();
  for (const a of animals) {
    if (a.category && !isSexCategory(categories.find((category) => category.code === a.category)?.label ?? '')) {
      categoryStats.set(a.category, (categoryStats.get(a.category) ?? 0) + 1);
    }
  }
  const categoryLabel = (code: string) => {
    const category = categories.find((item) => item.code === code);
    return category && isSexCategory(category.label) ? '' : category?.label ?? code;
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setBreedMenuOpen(false);
    setModalOpen(true);
  };

  const openEdit = (a: Animal) => {
    setEditing(a);
    setBreedMenuOpen(false);
    setForm({
      ica_code: a.ica_code, name: a.name, species: canonicalAnimalSpecies(a.species), category: a.category,
      breed: a.breed, sex: a.sex, birth_date: a.birth_date ?? '',
      weight_kg: a.weight_kg?.toString() ?? '', health_status: a.health_status,
      lactation_status: a.lactation_status ?? '', notes: a.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setPageError(null);
    const weightNum = form.weight_kg ? parseFloat(form.weight_kg) : null;
    let finalCategory = form.category;
    if (form.species === 'bovino' && !form.category && weightNum) {
      finalCategory = getAutoCategory(form.sex, weightNum) ?? '';
    }
    const payload = {
      ica_code: form.ica_code.trim(),
      name: '',
      species: form.species,
      category: finalCategory,
      breed: form.breed.trim(),
      sex: form.sex,
      birth_date: form.birth_date || null,
      weight_kg: weightNum,
      health_status: form.health_status,
      lactation_status: (form.species === 'bovino' && form.lactation_status) ? form.lactation_status : null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await apiRequest<Animal>(`/api/animals/${editing.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<Animal>('/api/animals/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo guardar el animal.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setPageError(null);
    try {
      await apiRequest<void>(`/api/animals/${deleteId}/`, { method: 'DELETE' });
      setDeleteId(null);
      await load();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo eliminar el animal.');
    }
  };

  const saveCategory = async () => {
    if (!catForm.label.trim()) return;
    setPageError(null);
    try {
      await apiRequest<AnimalCategory>('/api/animal-categories/', {
        method: 'POST',
        body: JSON.stringify({
          label: catForm.label.trim(),
          species: catForm.species,
          code: makeCategoryCode(catForm.label, catForm.species, categories),
          color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
        }),
      });
      setCatForm({ label: '', species: 'all' });
      await loadCategories();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo crear la categoría.');
    }
  };

  const deleteCategory = async () => {
    if (!catDeleteId) return;
    setPageError(null);
    try {
      await apiRequest<void>(`/api/animal-categories/${catDeleteId}/`, { method: 'DELETE' });
      setCatDeleteId(null);
      await loadCategories();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo eliminar la categoría.');
    }
  };

  const categoriesForSpecies = (species: string) =>
    categories.filter((c) => !isSexCategory(c.label)
      && (canonicalAnimalSpecies(c.species) === species || c.species === 'all'));
  const visibleCategories = categories.filter((category) => !isSexCategory(category.label));

  return (
    <div className="space-y-5">
      {pageError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}
      {/* Stats: total general + subtotales por especie + categorias */}
      {isAdmin && animals.length > 0 && (
        <div className="space-y-3">
          {/* Total general + subtotales por especie */}
          <div className="mt-grid">
            <div className="mt-card" style={{ backgroundColor: 'var(--mt-accent)', borderColor: 'var(--mt-accent)' }}>
              <p className="text-white/80 text-xs font-medium uppercase tracking-wide" style={{ fontSize: 'var(--mt-text-size)' }}>Total animales</p>
              <p className="text-3xl font-bold text-white">{animals.length}</p>
            </div>
            {Array.from(grouped.entries()).map(([species, list]) => (
              <div key={species} className="mt-card">
                <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>
                  {SPECIES_ICONS[species] ?? '🐾'} {SPECIES_LABELS[species] ?? species}
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--mt-heading-color)' }}>{list.length}</p>
              </div>
            ))}
          </div>

          {/* Desglose por categoria */}
          {categoryStats.size > 0 && (
            <div className="mt-card">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--mt-text-color)' }}>Desglose por categoria</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(categoryStats.entries()).map(([code, count]) => (
                  <div
                    key={code}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: `${catColor(code)}15`, border: `1px solid ${catColor(code)}40` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catColor(code) }} />
                    <span className="text-sm font-medium" style={{ color: catColor(code) }}>{catLabel(code)}</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--mt-heading-color)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por chapeta o raza..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            >
              <option value="all">Todas las especies</option>
              {ANIMAL_SPECIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="secondary" onClick={() => setCatModalOpen(true)}>
              <span className="flex items-center gap-2"><Tag size={18} /> Categorias</span>
            </Button>
          )}
          <Button onClick={openNew} style={{ backgroundColor: 'var(--mt-accent)' }}>
            <span className="flex items-center gap-2"><Plus size={18} /> {isAdmin ? 'Nuevo animal' : 'Registrar animal'}</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : animals.length === 0 ? (
        <EmptyState
          icon={<Beef size={28} />}
          title="No hay animales registrados"
          description="Agrega tu primer animal al inventario de la finca."
          action={<Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={18} /> Registrar animal</span></Button>}
        />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([species, list]) => (
            <div key={species} className="mt-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: 'var(--mt-table-header-bg)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>
                  <span className="text-xl">{SPECIES_ICONS[species] ?? '🐾'}</span>
                  {SPECIES_LABELS[species] ?? species}
                </h3>
                <Badge color="gray">{list.length} animal(es)</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100" style={{ backgroundColor: 'var(--mt-table-header-bg)' }}>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Chapeta ICA</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Categoria</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Sexo</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Raza</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Peso (kg)</th>
                      {species === 'bovino' && <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Estado</th>}
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Salud</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: 'var(--mt-text-color)' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {list.map((a) => (
                      <tr key={a.id} className="group" style={{ transition: 'background-color 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mt-table-hover-bg)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}>
                        <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--mt-text-color)' }}>
                          <span>{a.ica_code}</span>
                          {a.__offlineQueued && (
                            <span
                              className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                a.__offlineStatus === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : a.__offlineStatus === 'conflict'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                              }`}
                              title="Este cambio todavía no está confirmado en la base de datos."
                            >
                              {a.__offlineStatus === 'rejected'
                                ? 'Rechazado · solo local'
                                : a.__offlineStatus === 'conflict'
                                  ? 'Conflicto'
                                  : 'Pendiente de sincronizar'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--mt-text-color)' }}>
                          {a.category && catLabel(a.category) ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: `${catColor(a.category)}20`, color: catColor(a.category) }}>
                              {catLabel(a.category)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--mt-text-color)' }}>{a.sex === 'macho' ? 'Macho' : 'Hembra'}</td>
                        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--mt-text-color)' }}>{a.breed || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-right" style={{ color: 'var(--mt-text-color)' }}>{a.weight_kg ?? '—'}</td>
                        {species === 'bovino' && (
                          <td className="px-4 py-2.5">
                            {a.sex === 'hembra' && a.lactation_status ? (
                              <Badge color={LACTATION_COLORS[a.lactation_status]}>{LACTATION_LABELS[a.lactation_status]}</Badge>
                            ) : <span className="text-slate-300 text-sm">—</span>}
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          <Badge color={HEALTH_COLORS[a.health_status]}>{HEALTH_LABELS[a.health_status]}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className={`flex justify-end gap-1 ${isAdmin ? 'opacity-0 group-hover:opacity-100' : ''} transition-opacity`}>
                            <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><Pencil size={14} /></button>
                            {isAdmin && (
                              <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Animal modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar animal' : 'Nuevo animal'} size="lg">
        {(() => {
          const weightNum = form.weight_kg ? parseFloat(form.weight_kg) : null;
          const autoCategory = form.species === 'bovino' ? getAutoCategory(form.sex, weightNum) : null;
          const availableCats = categoriesForSpecies(form.species);
          const breedOptions = getBreedSuggestions(form.species);
          return (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Chapeta ICA *">
                <TextInput value={form.ica_code} onChange={(e) => setForm({ ...form, ica_code: e.target.value })} placeholder="001" />
              </Field>
              <Field label="Especie *">
                <Select value={form.species} onChange={(e) => {
                  setForm({
                    ...form,
                    species: e.target.value,
                    category: '',
                    lactation_status: e.target.value === 'bovino' ? form.lactation_status : '',
                    breed: '',
                  });
                  setBreedMenuOpen(false);
                }}>
                  {ANIMAL_SPECIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Sexo *">
                <Select value={form.sex} onChange={(e) => setForm({
                  ...form,
                  sex: e.target.value as 'macho' | 'hembra',
                  lactation_status: e.target.value === 'hembra' ? form.lactation_status : '',
                })}>
                  <option value="hembra">Hembra</option>
                  <option value="macho">Macho</option>
                </Select>
              </Field>
              <Field label="Peso (kg)">
                <TextInput type="number" step="0.01" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} placeholder="420" />
              </Field>
              <Field label="Categoria" className="sm:col-span-2">
                <div className="flex gap-2 items-center">
                  <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Sin categoria</option>
                    {availableCats.map((c) => (
                      <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                    ))}
                  </Select>
                  {autoCategory && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg whitespace-nowrap">
                      Sugerida: {catLabel(autoCategory)}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="Raza">
                {breedOptions.length > 0 ? (
                  <div className="relative">
                    <TextInput
                      value={form.breed}
                      role="combobox"
                      aria-expanded={breedMenuOpen}
                      aria-controls="animal-breed-options"
                      aria-autocomplete="list"
                      onFocus={() => setBreedMenuOpen(true)}
                      onChange={(e) => {
                        setForm({ ...form, breed: e.target.value });
                        setBreedMenuOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setBreedMenuOpen(false);
                        if (event.key === 'Enter' && breedMenuOpen) {
                          const match = breedOptions.find((breed) => breed.toLocaleLowerCase() === form.breed.trim().toLocaleLowerCase());
                          if (match) {
                            event.preventDefault();
                            setForm({ ...form, breed: match });
                            setBreedMenuOpen(false);
                          }
                        }
                      }}
                      placeholder="Seleccione o escriba la raza"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={breedMenuOpen ? 'Ocultar razas sugeridas' : 'Mostrar razas sugeridas'}
                      onClick={() => setBreedMenuOpen((open) => !open)}
                      className="absolute inset-y-0 right-2 flex items-center px-1 text-slate-500"
                    >
                      <ChevronDown size={16} />
                    </button>
                    {breedMenuOpen && (
                      <div
                        id="animal-breed-options"
                        role="listbox"
                        className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
                      >
                        {breedOptions
                          .filter((breed) => breed.toLocaleLowerCase().includes(form.breed.trim().toLocaleLowerCase()))
                          .map((breed) => (
                            <button
                              key={breed}
                              type="button"
                              role="option"
                              aria-selected={form.breed === breed}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setForm({ ...form, breed });
                                setBreedMenuOpen(false);
                              }}
                              className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              {breed}
                            </button>
                          ))}
                        {breedOptions.filter((breed) => breed.toLocaleLowerCase().includes(form.breed.trim().toLocaleLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-sm text-slate-500">Sin sugerencias; puedes conservar tu texto.</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <TextInput value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} placeholder="Escriba la raza" />
                )}
              </Field>
              <Field label="Fecha de nacimiento">
                <TextInput type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              </Field>
              <Field label="Estado de salud">
                <Select value={form.health_status} onChange={(e) => setForm({ ...form, health_status: e.target.value as Animal['health_status'] })}>
                  {Object.entries(HEALTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              {form.species === 'bovino' && form.sex === 'hembra' && (
                <Field label="Estado de lactacion">
                  <Select value={form.lactation_status} onChange={(e) => setForm({ ...form, lactation_status: e.target.value })}>
                    <option value="">Sin estado</option>
                    <option value="llenando">Llenando</option>
                    <option value="parida">Parida</option>
                  </Select>
                </Field>
              )}
              <Field label="Observaciones" className="sm:col-span-2">
                <TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionales..." />
              </Field>
            </div>
          );
        })()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.ica_code.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </Modal>

      {/* Category management modal */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title="Gestionar categorias" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Administra las categorías disponibles al registrar animales. Las categorías base del sistema no se pueden eliminar.
          </p>

          {/* Existing categories */}
          <div className="max-h-60 overflow-y-auto space-y-2">
            {visibleCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate text-sm font-medium text-slate-700">{c.label}</span>
                  <span className="text-xs text-slate-400">
                    {c.species === 'all' ? 'Todas las especies' : SPECIES_LABELS[canonicalAnimalSpecies(c.species)] ?? c.species}
                  </span>
                  {c.is_default && <Badge color="gray">Base</Badge>}
                </div>
                {!c.is_default && (
                  <button onClick={() => setCatDeleteId(c.id)} className="p-1 rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* New category form */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Agregar categoría</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre">
                <TextInput value={catForm.label} onChange={(e) => setCatForm({ ...catForm, label: e.target.value })} placeholder="Lechera" maxLength={120} />
              </Field>
              <Field label="Especie">
                <Select value={catForm.species} onChange={(e) => setCatForm({ ...catForm, species: e.target.value })}>
                  <option value="all">Todas</option>
                  {ANIMAL_SPECIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
            </div>
            <Button onClick={saveCategory} disabled={!catForm.label.trim()} className="w-full">
              <span className="flex items-center justify-center gap-2"><Plus size={18} /> Agregar categoria</span>
            </Button>
          </div>
        </div>
      </Modal>

      {isAdmin && (
        <ConfirmDialog
          open={!!deleteId}
          title="Eliminar animal"
          message="Seguro que deseas eliminar este animal? Esta accion no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      <ConfirmDialog
        open={!!catDeleteId}
        title="Eliminar categoria"
        message="Seguro que deseas eliminar esta categoria? Los animales existentes no se eliminaran pero perderan su categoria."
        onConfirm={deleteCategory}
        onCancel={() => setCatDeleteId(null)}
      />
    </div>
  );
}
