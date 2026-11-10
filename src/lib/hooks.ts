import { useEffect, useState } from 'react';
import { apiRequest, getActiveFarmId } from './api';
import type { Animal, MilkProduction, Vaccine, Crop, FishPond } from './types';
import { canonicalAnimalSpecies, isSexCategory } from './animalSpecies';

export function useOfflineSyncRefresh(refresh: () => void) {
  const activeFarmId = getActiveFarmId();

  useEffect(() => {
    const handleSync = (event: Event) => {
      const { farmIds } = (event as CustomEvent<{ farmIds?: string[] }>).detail ?? {};
      if (activeFarmId && farmIds?.includes(activeFarmId)) refresh();
    };
    window.addEventListener('finca-data-synced', handleSync);
    return () => window.removeEventListener('finca-data-synced', handleSync);
  }, [activeFarmId, refresh]);
}

export interface DashboardStats {
  totalAnimals: number;
  milkToday: number;
  pendingVaccines: number;
  activeCrops: number;
  activePonds: number;
  speciesBreakdown: { species: string; count: number }[];
  cattleBreakdown: { category: string; count: number }[];
  recentMilk: { date: string; total: number }[];
}

export function useDashboardStats(enabled: {
  animals: boolean;
  milk: boolean;
  vaccines: boolean;
  crops: boolean;
  fish: boolean;
}, enabledReady: boolean, shouldLoad = true): { stats: DashboardStats | null; loading: boolean; error: string | null } {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);

  useOfflineSyncRefresh(() => setSyncRevision((revision) => revision + 1));

  useEffect(() => {
    if (!enabledReady) return;
    if (!shouldLoad) {
      setStats(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
        const [animals, activeAnimals, milkToday, vaccines, crops, ponds, weekMilk] = await Promise.all([
          enabled.animals ? apiRequest<Animal[]>('/api/animals/') : Promise.resolve([]),
          enabled.animals ? apiRequest<Animal[]>('/api/animals/?active=true') : Promise.resolve([]),
          enabled.milk
            ? apiRequest<MilkProduction[]>(`/api/milk-production/?date_from=${today}&date_to=${today}`)
            : Promise.resolve([]),
          enabled.vaccines ? apiRequest<Vaccine[]>('/api/vaccines/?status=pendiente') : Promise.resolve([]),
          enabled.crops ? apiRequest<Crop[]>('/api/crops/?status=activo') : Promise.resolve([]),
          enabled.fish ? apiRequest<FishPond[]>('/api/fish-farming/?status=activo') : Promise.resolve([]),
          enabled.milk
            ? apiRequest<MilkProduction[]>(`/api/milk-production/?date_from=${weekStart}`)
            : Promise.resolve([]),
        ]);
        if (cancelled) return;

        const speciesMap = new Map<string, number>();
        const cattleMap = new Map<string, number>();
        for (const animal of animals) {
          const species = canonicalAnimalSpecies(animal.species);
          speciesMap.set(species, (speciesMap.get(species) ?? 0) + 1);
        }
        for (const animal of animals) {
          if (animal.category && animal.category !== 'M' && !isSexCategory(animal.category)) {
            cattleMap.set(animal.category, (cattleMap.get(animal.category) ?? 0) + 1);
          }
        }
        const speciesBreakdown = Array.from(speciesMap.entries())
          .map(([species, count]) => ({ species, count }))
          .sort((a, b) => b.count - a.count);
        const cattleBreakdown = Array.from(cattleMap.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => a.category.localeCompare(b.category));

        const dayMap = new Map<string, number>();
        for (const record of weekMilk) {
          dayMap.set(record.date, (dayMap.get(record.date) ?? 0) + Number(record.total_liters ?? 0));
        }
        const recentMilk = Array.from(dayMap.entries())
          .map(([date, total]) => ({ date, total }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setStats({
          totalAnimals: activeAnimals.length,
          milkToday: milkToday.reduce((sum, record) => sum + Number(record.total_liters ?? 0), 0),
          pendingVaccines: vaccines.length,
          activeCrops: crops.length,
          activePonds: ponds.length,
          speciesBreakdown,
          cattleBreakdown,
          recentMilk,
        });
      } catch (error) {
        console.error('No se pudieron cargar las estadísticas del dashboard.', error);
        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'No se pudieron cargar las estadísticas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled.animals, enabled.milk, enabled.vaccines, enabled.crops, enabled.fish, enabledReady, shouldLoad, syncRevision]);

  return { stats, loading, error };
}

export type { Animal, MilkProduction, Vaccine, Crop, FishPond };
