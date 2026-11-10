export const ANIMAL_SPECIES = [
  { value: 'bovino', label: 'Bovinos', icon: '🐄' },
  { value: 'equino', label: 'Equinos', icon: '🐎' },
  { value: 'porcino', label: 'Porcinos', icon: '🐖' },
  { value: 'caprino', label: 'Caprinos', icon: '🐐' },
  { value: 'ovino', label: 'Ovinos', icon: '🐑' },
  { value: 'otro', label: 'Otros', icon: '🐾' },
] as const;

const LEGACY_SPECIES: Record<string, string> = {
  vaca: 'bovino',
  vacas: 'bovino',
  toro: 'bovino',
  toros: 'bovino',
  ternero: 'bovino',
  terneros: 'bovino',
  novillo: 'bovino',
  novillos: 'bovino',
  novilla: 'bovino',
  novillas: 'bovino',
  caballo: 'equino',
  caballos: 'equino',
  caballa: 'equino',
  cerdo: 'porcino',
  cerdos: 'porcino',
  chivo: 'caprino',
  chivos: 'caprino',
  cabra: 'caprino',
  cabras: 'caprino',
  oveja: 'ovino',
  ovejas: 'ovino',
  cordero: 'ovino',
  corderos: 'ovino',
};

export const SPECIES_BREEDS: Record<string, string[]> = {
  bovino: ['Holstein', 'Jersey', 'Angus', 'Brahman', 'Gyr', 'Nelore', 'Simmental', 'Criollo'],
  equino: ['Caballo Criollo', 'Pura Raza Española', 'Quarter Horse', 'Thoroughbred', 'Mangalarga Marchador', 'Paso Fino', 'Árabe'],
};

export function canonicalAnimalSpecies(species: string): string {
  return LEGACY_SPECIES[species] ?? species;
}

export function getBreedSuggestions(species: string): string[] {
  return SPECIES_BREEDS[canonicalAnimalSpecies(species)] ?? [];
}

export function isSexCategory(label: string): boolean {
  return ['macho', 'hembra'].includes(label.trim().toLocaleLowerCase());
}
