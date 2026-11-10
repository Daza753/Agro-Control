import { Pill } from 'lucide-react';
import { CrudModule, Badge } from '../components/CrudModule';
import type { Medication } from '../lib/types';

const TYPE_LABELS: Record<string, string> = {
  antibiotico: 'Antibiótico', vitamina: 'Vitamina', desparasitante: 'Desparasitante',
  antiparasitario: 'Antiparasitario', otro: 'Otro',
};
const TYPE_COLORS: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'gray'> = {
  antibiotico: 'blue', vitamina: 'green', desparasitante: 'amber', antiparasitario: 'red', otro: 'gray',
};

export function Medications() {
  return (
    <CrudModule<Medication>
      config={{
        table: 'medications',
        title: 'Medicamentos',
        singular: 'medicamento',
        icon: <Pill size={28} />,
        searchFields: ['name', 'supplier', 'type'],
        filterField: {
          name: 'type',
          label: 'Todos los tipos',
          options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
        },
        defaultForm: { name: '', type: 'antibiotico', quantity: '', unit: 'ml', dose: '', expiry_date: '', supplier: '', notes: '' },
        fields: [
          { name: 'name', label: 'Nombre', type: 'text', required: true },
          { name: 'type', label: 'Tipo', type: 'select', options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'quantity', label: 'Cantidad', type: 'number', step: '0.01' },
          { name: 'unit', label: 'Unidad', type: 'text' },
          { name: 'dose', label: 'Dosis', type: 'text' },
          { name: 'expiry_date', label: 'Fecha de vencimiento', type: 'date' },
          { name: 'supplier', label: 'Proveedor', type: 'text' },
          { name: 'notes', label: 'Observaciones', type: 'textarea' },
        ],
        columns: [
          { key: 'name', label: 'Nombre', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
          { key: 'type', label: 'Tipo', render: (r) => <Badge color={TYPE_COLORS[r.type]}>{TYPE_LABELS[r.type]}</Badge> },
          { key: 'quantity', label: 'Cantidad', render: (r) => `${r.quantity} ${r.unit}` },
          { key: 'dose', label: 'Dosis' },
          { key: 'expiry_date', label: 'Vence', render: (r) => r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('es-CO') : '—' },
          { key: 'supplier', label: 'Proveedor' },
        ],
      }}
    />
  );
}
