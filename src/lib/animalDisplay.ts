import type { Animal } from './types';

export function getAnimalKind(animal: Pick<Animal, 'species' | 'sex' | 'category'>): string {
  if (['bovino', 'vaca', 'toro', 'ternero'].includes(animal.species)) {
    const categoryLabels: Record<string, string> = {
      NV: 'Novilla',
      NO: 'Novillo',
      TR: 'Ternera',
      TE: 'Ternero',
      TT: 'Torete',
      TO: 'Toro',
      VA: 'Vaca',
    };
    if (categoryLabels[animal.category.toLocaleUpperCase()]) {
      return categoryLabels[animal.category.toLocaleUpperCase()];
    }
    return animal.sex === 'macho' ? 'Toro' : 'Vaca';
  }
  if (['equino', 'caballo'].includes(animal.species)) {
    return animal.sex === 'macho' ? 'Caballo' : 'Yegua';
  }
  if (['porcino', 'cerdo'].includes(animal.species)) {
    return animal.sex === 'macho' ? 'Cerdo' : 'Cerda';
  }
  if (['caprino', 'chivo'].includes(animal.species)) {
    return animal.sex === 'macho' ? 'Chivo' : 'Cabra';
  }
  if (['ovino', 'oveja'].includes(animal.species)) {
    return animal.sex === 'macho' ? 'Carnero' : 'Oveja';
  }
  return animal.sex === 'macho' ? 'Animal macho' : 'Animal hembra';
}

export function getAnimalDisplayName(
  animal: Pick<Animal, 'id' | 'name' | 'notes' | 'species' | 'sex' | 'category'>,
): string {
  const nickname = animal.name.trim() || animal.notes?.trim().split(/\r?\n/, 1)[0].trim();
  return nickname
    ? `${getAnimalKind(animal)} · ${nickname}`
    : `${getAnimalKind(animal)} sin apodo`;
}
