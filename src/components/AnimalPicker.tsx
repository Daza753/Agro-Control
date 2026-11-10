import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Animal } from '../lib/types';
import { getAnimalDisplayName } from '../lib/animalDisplay';
import { inputClass } from './ui';

type AnimalOption = Pick<
  Animal,
  'id' | 'ica_code' | 'name' | 'species' | 'sex' | 'notes' | 'breed' | 'category'
>;

interface AnimalPickerProps {
  animals: AnimalOption[];
  value: string;
  onChange: (animalId: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}

export function AnimalPicker({
  animals,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = 'Sin animal específico',
  disabled = false,
}: AnimalPickerProps) {
  const selected = animals.find((animal) => animal.id === value);
  const listId = useId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) setSearch(selected ? getAnimalDisplayName(selected) : '');
  }, [open, selected]);

  const matchingAnimals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return animals;
    return animals.filter((animal) => [
      getAnimalDisplayName(animal),
      animal.ica_code,
      animal.breed,
      animal.category,
      animal.species,
      animal.sex,
      animal.notes ?? '',
    ].some((field) => field.toLocaleLowerCase().includes(query)));
  }, [animals, search]);
  const filteredAnimals = matchingAnimals.slice(0, 50);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={search}
          disabled={disabled}
          onFocus={() => {
            setSearch('');
            setOpen(true);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          placeholder="Busca por animal, apodo o chapeta"
          className={`${inputClass} pl-9 pr-9`}
        />
        {selected ? (
          <button
            type="button"
            aria-label="Limpiar animal seleccionado"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('');
              setSearch('');
              setOpen(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        ) : (
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        )}
      </div>
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          aria-label="Animales disponibles"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {allowEmpty && (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange('');
                setSearch('');
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
            >
              {emptyLabel}
              {!value && <Check size={15} />}
            </button>
          )}
          {filteredAnimals.map((animal) => (
            <button
              key={animal.id}
              type="button"
              role="option"
              aria-selected={animal.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(animal.id);
                setSearch('');
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{getAnimalDisplayName(animal)}</span>
                <span className="block truncate text-xs text-slate-500">
                  {animal.breed || 'Sin raza registrada'}
                </span>
              </span>
              {animal.id === value && <Check size={15} className="flex-shrink-0 text-emerald-700" />}
            </button>
          ))}
          {filteredAnimals.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-500">No encontramos animales con esa búsqueda.</p>
          )}
          {matchingAnimals.length > 50 && (
            <p className="px-3 py-2 text-xs text-slate-500">Hay más resultados; escribe otro dato para afinar la búsqueda.</p>
          )}
        </div>
      )}
    </div>
  );
}
