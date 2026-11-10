import { Wrench } from 'lucide-react';
import { CrudModule, Badge } from '../components/CrudModule';
import type { Equipment } from '../lib/types';

const TYPE_LABELS: Record<string, string> = {
  motosierra: 'Motosierra', guadana: 'Guadaña', bomba_fumigadora: 'Bomba fumigadora',
  tractor: 'Tractor', herramienta_manual: 'Herramienta manual', otro: 'Otro',
};
const STATUS_LABELS: Record<string, string> = {
  bueno: 'Bueno', regular: 'Regular', malo: 'Malo', en_reparacion: 'En reparación',
};
const STATUS_COLORS: Record<string, 'green' | 'yellow' | 'red' | 'blue'> = {
  bueno: 'green', regular: 'yellow', malo: 'red', en_reparacion: 'blue',
};

export function EquipmentPage() {
  return (
    <CrudModule<Equipment>
      config={{
        table: 'equipment',
        title: 'Equipos',
        singular: 'equipo',
        icon: <Wrench size={28} />,
        searchFields: ['name', 'type'],
        filterField: {
          name: 'status',
          label: 'Todos los estados',
          options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        },
        defaultForm: { name: '', type: 'tractor', status: 'bueno', last_maintenance_date: '', next_maintenance_date: '', notes: '' },
        fields: [
          { name: 'name', label: 'Nombre', type: 'text', required: true },
          { name: 'type', label: 'Tipo', type: 'select', options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'status', label: 'Estado', type: 'select', options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'last_maintenance_date', label: 'Último mantenimiento', type: 'date' },
          { name: 'next_maintenance_date', label: 'Próximo mantenimiento', type: 'date' },
          { name: 'notes', label: 'Observaciones', type: 'textarea' },
        ],
        columns: [
          { key: 'name', label: 'Nombre', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
          { key: 'type', label: 'Tipo', render: (r) => TYPE_LABELS[r.type] ?? r.type },
          { key: 'status', label: 'Estado', render: (r) => <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge> },
          { key: 'last_maintenance_date', label: 'Últ. mantenimiento', render: (r) => r.last_maintenance_date ? new Date(r.last_maintenance_date).toLocaleDateString('es-CO') : '—' },
          { key: 'next_maintenance_date', label: 'Próx. mantenimiento', render: (r) => r.next_maintenance_date ? new Date(r.next_maintenance_date).toLocaleDateString('es-CO') : '—' },
        ],
      }}
    />
  );
}
