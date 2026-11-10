import { Fish } from 'lucide-react';
import { CrudModule, Badge } from '../components/CrudModule';
import type { FishPond } from '../lib/types';

const STATUS_LABELS: Record<string, string> = { activo: 'Activo', cosechado: 'Cosechado', inactivo: 'Inactivo' };
const STATUS_COLORS: Record<string, 'green' | 'blue' | 'gray'> = { activo: 'green', cosechado: 'blue', inactivo: 'gray' };

export function FishFarming() {
  return (
    <CrudModule<FishPond>
      config={{
        table: 'fish_farming',
        title: 'Estanques',
        singular: 'estanque',
        icon: <Fish size={28} />,
        searchFields: ['pond_name', 'species'],
        filterField: {
          name: 'status',
          label: 'Todos los estados',
          options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        },
        defaultForm: { pond_name: '', species: '', quantity: '', avg_weight_kg: '', feeding_notes: '', mortality: '0', production_kg: '', status: 'activo', notes: '' },
        fields: [
          { name: 'pond_name', label: 'Nombre del estanque', type: 'text', required: true },
          { name: 'species', label: 'Especie de peces', type: 'text', required: true },
          { name: 'quantity', label: 'Cantidad', type: 'number' },
          { name: 'avg_weight_kg', label: 'Peso promedio (kg)', type: 'number', step: '0.01' },
          { name: 'mortality', label: 'Mortalidad', type: 'number' },
          { name: 'production_kg', label: 'Producción (kg)', type: 'number', step: '0.01' },
          { name: 'status', label: 'Estado', type: 'select', options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'feeding_notes', label: 'Alimentación', type: 'textarea' },
          { name: 'notes', label: 'Observaciones', type: 'textarea' },
        ],
        columns: [
          { key: 'pond_name', label: 'Estanque', render: (r) => <span className="font-medium text-slate-800">{r.pond_name}</span> },
          { key: 'species', label: 'Especie' },
          { key: 'quantity', label: 'Cantidad' },
          { key: 'avg_weight_kg', label: 'Peso prom.', render: (r) => r.avg_weight_kg ? `${r.avg_weight_kg} kg` : '—' },
          { key: 'mortality', label: 'Mortalidad' },
          { key: 'production_kg', label: 'Producción', render: (r) => r.production_kg ? `${r.production_kg} kg` : '—' },
          { key: 'status', label: 'Estado', render: (r) => <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge> },
        ],
      }}
    />
  );
}
