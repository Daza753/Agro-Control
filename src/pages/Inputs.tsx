import { FlaskConical } from 'lucide-react';
import { CrudModule, Badge } from '../components/CrudModule';
import type { Input } from '../lib/types';

const TYPE_LABELS: Record<string, string> = {
  fertilizante: 'Fertilizante', herbicida: 'Herbicida', insecticida: 'Insecticida',
  veneno: 'Veneno', semilla: 'Semilla', otro: 'Otro',
};
const TYPE_COLORS: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray'> = {
  fertilizante: 'green', herbicida: 'amber', insecticida: 'red', veneno: 'red', semilla: 'blue', otro: 'gray',
};

export function Inputs() {
  return (
    <CrudModule<Input>
      config={{
        table: 'inputs',
        title: 'Insumos',
        singular: 'insumo',
        icon: <FlaskConical size={28} />,
        searchFields: ['name', 'supplier', 'type'],
        filterField: {
          name: 'type',
          label: 'Todos los tipos',
          options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
        },
        defaultForm: { name: '', type: 'fertilizante', quantity: '', unit: 'kg', supplier: '', purchase_date: '', price: '', notes: '' },
        fields: [
          { name: 'name', label: 'Nombre', type: 'text', required: true },
          { name: 'type', label: 'Tipo', type: 'select', options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'quantity', label: 'Cantidad', type: 'number', step: '0.01' },
          { name: 'unit', label: 'Unidad', type: 'text' },
          { name: 'supplier', label: 'Proveedor', type: 'text' },
          { name: 'purchase_date', label: 'Fecha de compra', type: 'date' },
          { name: 'price', label: 'Precio', type: 'number', step: '0.01' },
          { name: 'notes', label: 'Observaciones', type: 'textarea' },
        ],
        columns: [
          { key: 'name', label: 'Nombre', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
          { key: 'type', label: 'Tipo', render: (r) => <Badge color={TYPE_COLORS[r.type]}>{TYPE_LABELS[r.type]}</Badge> },
          { key: 'quantity', label: 'Existencias', render: (r) => `${r.quantity} ${r.unit}` },
          { key: 'supplier', label: 'Proveedor' },
          { key: 'purchase_date', label: 'Compra', render: (r) => r.purchase_date ? new Date(r.purchase_date).toLocaleDateString('es-CO') : '—' },
          { key: 'price', label: 'Precio', render: (r) => r.price ? `$${r.price.toLocaleString('es-CO')}` : '—' },
        ],
      }}
    />
  );
}
