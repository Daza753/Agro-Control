import { Sprout } from 'lucide-react';
import { CrudModule, Badge } from '../components/CrudModule';
import type { Crop } from '../lib/types';

const TYPE_LABELS: Record<string, string> = {
  maiz: 'Maíz', yuca: 'Yuca', frijol: 'Fríjol', pasto: 'Pasto', otro: 'Otro',
};
const STATUS_LABELS: Record<string, string> = { activo: 'Activo', cosechado: 'Cosechado', perdido: 'Perdido' };
const STATUS_COLORS: Record<string, 'green' | 'blue' | 'red'> = { activo: 'green', cosechado: 'blue', perdido: 'red' };

export function Crops() {
  return (
    <CrudModule<Crop>
      config={{
        table: 'crops',
        title: 'Cultivos',
        singular: 'cultivo',
        icon: <Sprout size={28} />,
        searchFields: ['name', 'type'],
        filterField: {
          name: 'status',
          label: 'Todos los estados',
          options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        },
        defaultForm: { name: '', type: 'maiz', area_hectares: '', planting_date: '', expected_harvest_date: '', harvest_date: '', fertilization_notes: '', production_kg: '', status: 'activo', notes: '' },
        fields: [
          { name: 'name', label: 'Nombre', type: 'text', required: true },
          { name: 'type', label: 'Tipo', type: 'select', options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'area_hectares', label: 'Área (hectáreas)', type: 'number', step: '0.01' },
          { name: 'planting_date', label: 'Fecha de siembra', type: 'date' },
          { name: 'expected_harvest_date', label: 'Cosecha esperada', type: 'date' },
          { name: 'harvest_date', label: 'Fecha de cosecha', type: 'date' },
          { name: 'production_kg', label: 'Producción (kg)', type: 'number', step: '0.01' },
          { name: 'status', label: 'Estado', type: 'select', options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'fertilization_notes', label: 'Fertilización', type: 'textarea' },
          { name: 'notes', label: 'Observaciones', type: 'textarea' },
        ],
        columns: [
          { key: 'name', label: 'Nombre', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
          { key: 'type', label: 'Tipo', render: (r) => TYPE_LABELS[r.type] ?? r.type },
          { key: 'area_hectares', label: 'Área', render: (r) => r.area_hectares ? `${r.area_hectares} ha` : '—' },
          { key: 'planting_date', label: 'Siembra', render: (r) => r.planting_date ? new Date(r.planting_date).toLocaleDateString('es-CO') : '—' },
          { key: 'production_kg', label: 'Producción', render: (r) => r.production_kg ? `${r.production_kg} kg` : '—' },
          { key: 'status', label: 'Estado', render: (r) => <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge> },
        ],
      }}
    />
  );
}
