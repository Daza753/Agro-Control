import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from './ui';

interface ImageUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function ImageUploadField({ label, value, onChange }: ImageUploadFieldProps) {
  const [error, setError] = useState<string | null>(null);

  const selectImage = (file?: File) => {
    setError(null);
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Selecciona una imagen PNG, JPG, WEBP o GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('La imagen no debe superar 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('No se pudo procesar la imagen seleccionada.');
        return;
      }
      onChange(reader.result);
    };
    reader.onerror = () => setError('No se pudo leer la imagen seleccionada.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={22} className="text-slate-400" />
          )}
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Elegir imagen
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              selectImage(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        {value && (
          <Button variant="secondary" onClick={() => onChange(null)}>
            <span className="flex items-center gap-2"><Trash2 size={15} /> Quitar</span>
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">Máximo 2 MB. Usa PNG transparente si quieres que el diseño no muestre fondo; el fondo no se elimina automáticamente.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
