import { useState, useEffect, useRef } from 'react';
import { Palette, Upload, Check, RotateCcw, Link, Image as ImageIcon, Loader2, Lock, Sliders, Shield, ToggleLeft, ToggleRight, Loader2 as Spinner, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../lib/auth';
import type { FarmSettings } from '../lib/types';
import { apiRequest, getActiveFarmId, setActiveFarmId } from '../lib/api';
import type { Farm } from '../lib/types';
import { BACKGROUND_MODE_STORAGE_KEY, getStoredBackgroundMode } from '../lib/settings';
import { Modal, Field, TextInput, Button, Badge } from '../components/ui';
import { ModuleThemeEditor } from '../components/ModuleThemeEditor';
import { useModuleAccess } from '../lib/moduleAccess';
import { ImageUploadField } from '../components/ImageUploadField';

const PRESET_COLORS = [
  { name: 'Esmeralda', primary: '#059669', accent: '#10b981' },
  { name: 'Azul', primary: '#2563eb', accent: '#3b82f6' },
  { name: 'Indigo', primary: '#4f46e5', accent: '#6366f1' },
  { name: 'Ambar', primary: '#d97706', accent: '#f59e0b' },
  { name: 'Rojo', primary: '#dc2626', accent: '#ef4444' },
  { name: 'Rosa', primary: '#db2777', accent: '#ec4899' },
  { name: 'Violeta', primary: '#7c3aed', accent: '#8b5cf6' },
  { name: 'Cyan', primary: '#0891b2', accent: '#06b6d4' },
];

const RESERVED_RIGHTS = 'Derechos reservados © Oscar David Vega Daza';

interface Props {
  onSettingsChange: (settings: FarmSettings) => void;
}

export function Settings({ onSettingsChange }: Props) {
  const [settings, setSettings] = useState<FarmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'access' | 'farms'>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id && !getActiveFarmId()) {
      setLoading(false);
      return;
    }
    loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    try {
      const rows = await apiRequest<FarmSettings[]>('/api/farm-settings/');
      const data = rows[0];
      if (data) {
        setSettings({ ...data, background_mode: data.background_mode ?? getStoredBackgroundMode() });
        setLogoUrlInput(data.logo_url || '');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar la configuración.';
      setSaveError(message);
      console.error('Error loading farm settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof FarmSettings>(key: K, value: FarmSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setSaved(false);
    setSaveError(null);
    setSaveNotice(null);
  };

  const uploadLogo = async (file: File) => {
    if (!file) return;
    setUploadError(null);

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError('Selecciona una imagen PNG, JPG, WEBP o GIF.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('La imagen no debe superar 2MB');
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('No se pudo leer la imagen.'));
        reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      });
      setLogoUrlInput(publicUrl);
      updateField('logo_url', publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al procesar la imagen.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeLogo = () => {
    setLogoUrlInput('');
    updateField('logo_url', null);
  };

  const save = async () => {
    if (!settings || !user?.id) return;
    setSaving(true);
    setSaveError(null);

    const payload = {
      farm_name: settings.farm_name,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      secondary_color: settings.secondary_color,
      accent_color: settings.accent_color,
      background_mode: settings.background_mode,
      sidebar_style: settings.sidebar_style,
      header_style: settings.header_style,
      show_footer: true,
      footer_text: RESERVED_RIGHTS,
    };

    try {
      await apiRequest(`/api/farm-settings/${settings.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      window.localStorage.removeItem(BACKGROUND_MODE_STORAGE_KEY);
      setSaveNotice(null);
      setSaved(true);
      onSettingsChange({ ...settings, show_footer: true, footer_text: RESERVED_RIGHTS });
    } catch (error) {
      console.error('Error saving farm settings:', error);
      const reason =
        typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : 'Error desconocido';
      setSaveError(`No se pudieron guardar los cambios: ${reason}`);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    const defaults = {
      farm_name: 'Mi Finca',
      logo_url: null,
      primary_color: '#059669',
      secondary_color: '#0f172a',
      accent_color: '#10b981',
      background_mode: 'light' as const,
      sidebar_style: 'dark' as const,
      header_style: 'light' as const,
      show_footer: true,
      footer_text: RESERVED_RIGHTS,
    };
    if (settings) {
      setSettings({ ...settings, ...defaults });
      setLogoUrlInput('');
      setSaved(false);
      setSaveError(null);
      setSaveNotice(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (activeTab === 'farms' || !settings) {
    return <FarmManagementPanel onBack={settings ? () => setActiveTab('general') : undefined} />;
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'general'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Palette size={18} /> Diseno general
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'modules'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sliders size={18} /> Diseno por modulo
        </button>
        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'access'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield size={18} /> Acceso a modulos
        </button>
        <button
          onClick={() => setActiveTab('farms')}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-all"
        >
          Fincas
        </button>
      </div>

      {activeTab === 'modules' ? (
        <ModuleThemeEditor />
      ) : activeTab === 'access' ? (
        <ModuleAccessPanel />
      ) : (
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configuracion de Diseno</h2>
          <p className="text-slate-500 text-sm mt-1">Personaliza la apariencia de tu aplicacion</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={resetToDefault}>
            <RotateCcw size={18} className="mr-2" /> Restablecer
          </Button>
          <Button onClick={save} disabled={saving}>
            {saved ? <Check size={18} className="mr-2" /> : null}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
      {saveNotice && <p role="status" className="text-sm text-amber-700">{saveNotice}</p>}

      {/* Preview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Vista previa</h3>
        <div className="rounded-xl overflow-hidden border border-slate-200">
          {/* Mini Sidebar Preview */}
          <div className="flex">
            <div
              className="w-24 p-2 flex flex-col items-center gap-1"
              style={{ backgroundColor: settings.sidebar_style === 'dark' ? settings.secondary_color : '#fff' }}
            >
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-8 h-8 rounded object-cover" />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  {settings.farm_name.charAt(0)}
                </div>
              )}
              <p
                className="text-[8px] font-bold text-center leading-tight"
                style={{ color: settings.sidebar_style === 'dark' ? '#fff' : settings.secondary_color }}
              >
                {settings.farm_name.toUpperCase().slice(0, 12)}
              </p>
              <div
                className="w-full h-4 rounded flex items-center justify-center text-[6px]"
                style={{ backgroundColor: settings.primary_color, color: '#fff' }}
              >
                Menu
              </div>
            </div>
            {/* Mini Header + Content */}
            <div className="flex-1">
              <div
                className="px-3 py-2 flex items-center justify-between"
                style={{
                  backgroundColor: settings.header_style === 'transparent' ? 'transparent' :
                    settings.header_style === 'dark' ? settings.secondary_color : '#fff',
                }}
              >
                <h4
                  className="text-xs font-semibold"
                  style={{ color: settings.header_style === 'dark' ? '#fff' : settings.secondary_color }}
                >
                  Pagina
                </h4>
                <Badge color="green">Admin</Badge>
              </div>
              <div
                className="p-3"
                style={{ backgroundColor: settings.background_mode === 'dark' ? '#0f172a' : '#f8fafc' }}
              >
                <div className="h-3 w-3/4 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-1/2 bg-slate-200 rounded mb-2" />
                <div
                  className="h-6 w-24 rounded text-[8px] flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  Boton
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* General background */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-2">Fondo general</h3>
          <p className="text-sm text-slate-500 mb-4">
            Se aplica a toda la aplicacion. Los colores personalizados por modulo se conservan.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateField('background_mode', 'light')}
              aria-pressed={settings.background_mode === 'light'}
              className={`p-4 rounded-xl border-2 text-left transition-all ${settings.background_mode === 'light' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="w-full h-12 rounded bg-slate-50 border border-slate-200 mb-2" />
              <p className="font-medium text-slate-800">Claro</p>
            </button>
            <button
              type="button"
              onClick={() => updateField('background_mode', 'dark')}
              aria-pressed={settings.background_mode === 'dark'}
              className={`p-4 rounded-xl border-2 text-left transition-all ${settings.background_mode === 'dark' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="w-full h-12 rounded bg-slate-900 border border-slate-700 mb-2" />
              <p className="font-medium text-slate-800">Oscuro</p>
            </button>
          </div>
        </div>

        {/* Farm Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Palette size={20} /> Informacion de la Finca
          </h3>
          <div className="space-y-4">
            <Field label="Nombre de la finca">
              <TextInput
                value={settings.farm_name}
                onChange={(e) => updateField('farm_name', e.target.value)}
                placeholder="Mi Finca"
              />
            </Field>

            {/* Logo upload section */}
            <Field label="Logo de la finca">
              <div className="space-y-3">
                {/* Current logo preview */}
                {settings.logo_url && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <img
                      src={settings.logo_url}
                      alt="Logo actual"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                      onError={removeLogo}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">Logo actual</p>
                      <button
                        onClick={removeLogo}
                        className="text-xs text-red-600 hover:underline mt-1"
                      >
                        Quitar logo
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <Loader2 size={18} className="mr-2 animate-spin" />
                    ) : (
                      <Upload size={18} className="mr-2" />
                    )}
                    {uploading ? 'Subiendo...' : 'Subir desde equipo'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowUrlModal(true)}
                    className="flex-1"
                  >
                    <Link size={18} className="mr-2" /> Usar URL
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {uploadError && (
                  <p className="text-xs text-red-600">{uploadError}</p>
                )}

                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <ImageIcon size={12} />
                  Formatos: PNG, JPG, SVG. Maximo 2MB.
                </p>
              </div>
            </Field>
          </div>
        </div>

        {/* Colors */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Colores del tema</h3>
          <div className="space-y-4">
            <Field label="Color primario (botones, menu activo)">
              <div className="flex gap-2 flex-wrap mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      updateField('primary_color', c.primary);
                      updateField('accent_color', c.accent);
                    }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${settings.primary_color === c.primary ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.primary }}
                    title={c.name}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => updateField('primary_color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={settings.primary_color}
                  onChange={(e) => updateField('primary_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>
            <Field label="Color secundario (sidebar)">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={settings.secondary_color}
                  onChange={(e) => updateField('secondary_color', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <TextInput
                  value={settings.secondary_color}
                  onChange={(e) => updateField('secondary_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Sidebar Style */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Estilo del menu lateral</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateField('sidebar_style', 'dark')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${settings.sidebar_style === 'dark' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="w-full h-12 rounded bg-slate-900 mb-2" />
              <p className="font-medium text-slate-800">Oscuro</p>
            </button>
            <button
              onClick={() => updateField('sidebar_style', 'light')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${settings.sidebar_style === 'light' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="w-full h-12 rounded bg-white border border-slate-200 mb-2" />
              <p className="font-medium text-slate-800">Claro</p>
            </button>
          </div>
        </div>

        {/* Header Style */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Estilo de la barra superior</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => updateField('header_style', 'light')}
              className={`p-3 rounded-xl border-2 text-center transition-all ${settings.header_style === 'light' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="w-full h-6 rounded bg-white border border-slate-200 mb-2" />
              <p className="text-xs font-medium text-slate-700">Claro</p>
            </button>
            <button
              onClick={() => updateField('header_style', 'dark')}
              className={`p-3 rounded-xl border-2 text-center transition-all ${settings.header_style === 'dark' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="w-full h-6 rounded bg-slate-900 mb-2" />
              <p className="text-xs font-medium text-slate-700">Oscuro</p>
            </button>
            <button
              onClick={() => updateField('header_style', 'transparent')}
              className={`p-3 rounded-xl border-2 text-center transition-all ${settings.header_style === 'transparent' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="w-full h-6 rounded bg-gradient-to-r from-slate-100 to-slate-50 border border-dashed border-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-700">Transparente</p>
            </button>
          </div>
        </div>

        {/* Footer - Reserved Rights (not editable) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Lock size={18} /> Derechos reservados
          </h3>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-sm text-slate-700 font-medium">{RESERVED_RIGHTS}</p>
            <p className="text-xs text-slate-400 mt-1">Este texto no se puede modificar.</p>
          </div>
        </div>
      </div>

      {/* URL Modal */}
      <Modal open={showUrlModal} onClose={() => setShowUrlModal(false)} title="Logo desde URL" size="sm">
        <div className="space-y-4">
          <Field label="URL de la imagen">
            <TextInput
              value={logoUrlInput}
              onChange={(e) => setLogoUrlInput(e.target.value)}
              placeholder="https://ejemplo.com/logo.png"
              autoFocus
            />
          </Field>
          {logoUrlInput && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <img
                src={logoUrlInput}
                alt="Vista previa"
                className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                onError={() => setLogoUrlInput('')}
              />
              <span className="text-xs text-slate-500">Vista previa</span>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowUrlModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                updateField('logo_url', logoUrlInput || null);
                setShowUrlModal(false);
              }}
            >
              <Check size={18} className="mr-2" /> Confirmar
            </Button>
          </div>
        </div>
      </Modal>
      </div>
      )}
    </div>
  );
}

function ModuleAccessPanel() {
  const { access, refresh } = useModuleAccess();
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (moduleKey: string, current: boolean) => {
    setToggling(moduleKey);
    setError(null);
    const entry = access[moduleKey];

    try {
      if (entry) {
        await apiRequest(`/api/module-access/${entry.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled_for_workers: !current }),
        });
      } else {
        await apiRequest('/api/module-access/', {
          method: 'POST',
          body: JSON.stringify({
            module_key: moduleKey,
            enabled_for_workers: !current,
            label: moduleKey,
          }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el acceso al módulo.');
    } finally {
      setToggling(null);
      refresh();
    }
  };

  const moduleOrder = [
    'dashboard', 'animals', 'milk', 'vaccines', 'medications',
    'inputs', 'equipment', 'crops', 'fish', 'activities',
    'diseases', 'reports', 'users', 'settings',
  ];
  const moduleLabels: Record<string, string> = {
    dashboard: 'Inicio',
    animals: 'Animales',
    milk: 'Producción de leche',
    vaccines: 'Vacunas',
    medications: 'Medicamentos',
    inputs: 'Insumos',
    equipment: 'Equipos',
    crops: 'Cultivos',
    fish: 'Piscicultura',
    activities: 'Actividades',
    diseases: 'Enfermedades',
    reports: 'Reportes',
    users: 'Usuarios',
    settings: 'Configuración',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield size={24} /> Acceso a           Módulos
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Controla que modulos pueden ver y usar los trabajadores. El administrador siempre tiene acceso a todos los modulos.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Lock size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Importante</p>
          <p className="text-xs text-amber-700 mt-1">
            Al bloquear un modulo, los trabajadores de esta finca dejaran de verlo y tampoco podran
            consultar sus datos desde la API. El administrador conserva el acceso.
          </p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Modulo</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Trabajadores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {moduleOrder.map((key) => {
              const entry = access[key];
              const enabled = entry ? entry.enabled_for_workers : true;
              const label = moduleLabels[key] ?? entry?.label ?? key;
              return (
                <tr key={key} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-700">{label}</td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => toggle(key, enabled)}
                      disabled={toggling === key}
                      aria-label={`${enabled ? 'Bloquear' : 'Habilitar'} ${label} para empleados`}
                      aria-pressed={!enabled}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        enabled
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {toggling === key ? (
                        <Spinner size={16} className="animate-spin" />
                      ) : enabled ? (
                        <ToggleRight size={20} />
                      ) : (
                        <ToggleLeft size={20} />
                      )}
                      {enabled ? 'Habilitado' : 'Bloqueado para empleados'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        El cambio se aplica a los trabajadores de esta finca. Los administradores conservan acceso.
      </p>
    </div>
  );
}

function FarmManagementPanel({ onBack }: { onBack?: () => void }) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farmToDelete, setFarmToDelete] = useState<Farm | null>(null);
  const [farmNameConfirmation, setFarmNameConfirmation] = useState('');
  const [deletionAcknowledged, setDeletionAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [editName, setEditName] = useState('');
  const [editLogo, setEditLogo] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    apiRequest<Farm[]>('/api/auth/farms/')
      .then(setFarms)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las fincas.');
      })
      .finally(() => setLoading(false));
  }, []);

  const createFarm = async () => {
    setSaving(true);
    setError(null);
    try {
      const farm = await apiRequest<Farm>('/api/auth/farms/', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setActiveFarmId(farm.id);
      window.location.reload();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la finca.');
    } finally {
      setSaving(false);
    }
  };

  const deleteFarm = async () => {
    if (!farmToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest<void>(`/api/auth/farms/${farmToDelete.id}/`, { method: 'DELETE' });
      const nextFarm = farms.find((farm) => farm.id !== farmToDelete.id);
      setActiveFarmId(
        getActiveFarmId() === farmToDelete.id
          ? nextFarm?.id ?? null
          : getActiveFarmId(),
      );
      window.location.reload();
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error ? deleteFailure.message : 'No se pudo eliminar la finca.',
      );
      setDeleting(false);
    }
  };

  const saveFarm = async () => {
    if (!editingFarm) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await apiRequest<Farm>(`/api/auth/farms/${editingFarm.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim(), logo_url: editLogo }),
      });
      setFarms((current) => current.map((farm) => farm.id === updated.id ? updated : farm));
      setEditingFarm(null);
      if (getActiveFarmId() === updated.id) window.location.reload();
    } catch (saveFailure) {
      setError(saveFailure instanceof Error ? saveFailure.message : 'No se pudo actualizar la finca.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-800">Fincas del propietario</h2>
          {onBack && <Button variant="secondary" onClick={onBack}>Volver a configuración</Button>}
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Cada trabajador se asigna a una finca y solo accede a los datos y permisos de ese predio.
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <Field label="Nombre de la finca">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Finca El Porvenir" />
        </Field>
        <Button onClick={createFarm} disabled={saving || !name.trim()}>
          {saving ? 'Creando...' : 'Crear finca'}
        </Button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Cargando fincas...</p>
        ) : farms.length ? farms.map((farm) => (
          <div key={farm.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {farm.logo_url ? (
                  <img src={farm.logo_url} alt={`Logo de ${farm.name}`} className="h-full w-full object-contain" />
                ) : <ImageIcon size={20} className="text-slate-400" />}
              </div>
              <span className="truncate font-medium text-slate-700">{farm.name}</span>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingFarm(farm);
                  setEditName(farm.name);
                  setEditLogo(farm.logo_url);
                  setError(null);
                }}
              >
                <span className="flex items-center gap-2"><Pencil size={15} /> Editar</span>
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setFarmToDelete(farm);
                  setFarmNameConfirmation('');
                  setDeletionAcknowledged(false);
                  setDeleteError(null);
                }}
              >
                <span className="flex items-center gap-2"><Trash2 size={16} /> Eliminar</span>
              </Button>
            </div>
          </div>
        )) : (
          <p className="p-5 text-sm text-slate-500">Aún no tienes fincas creadas.</p>
        )}
      </div>
      <Modal open={!!editingFarm} onClose={() => setEditingFarm(null)} title="Editar finca">
        <div className="space-y-4">
          <Field label="Nombre de la finca">
            <TextInput value={editName} onChange={(event) => setEditName(event.target.value)} />
          </Field>
          <ImageUploadField label="Logo o foto representativa de la finca" value={editLogo} onChange={setEditLogo} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditingFarm(null)}>Cancelar</Button>
            <Button onClick={saveFarm} disabled={savingEdit || !editName.trim()}>
              {savingEdit ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={!!farmToDelete}
        onClose={() => {
          if (deleting) return;
          setFarmToDelete(null);
          setDeleteError(null);
        }}
        title="Eliminar finca definitivamente"
      >
        {farmToDelete && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-bold">Esta acción es permanente y no se puede deshacer.</p>
              <p className="mt-2">
                Se eliminarán la finca <strong>{farmToDelete.name}</strong>, todos sus registros y
                las cuentas de los trabajadores asignados. No podrás recuperar esta información.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={deletionAcknowledged}
                onChange={(event) => setDeletionAcknowledged(event.target.checked)}
                className="mt-1"
              />
              Confirmo que entiendo que también se eliminarán los datos y accesos de sus trabajadores.
            </label>
            <Field label={`Escribe exactamente "${farmToDelete.name}" para confirmar`}>
              <TextInput
                value={farmNameConfirmation}
                onChange={(event) => setFarmNameConfirmation(event.target.value)}
                autoComplete="off"
              />
            </Field>
            {deleteError && <p role="alert" className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setFarmToDelete(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={
                  deleting
                  || !deletionAcknowledged
                  || farmNameConfirmation !== farmToDelete.name
                }
                onClick={deleteFarm}
              >
                {deleting ? 'Eliminando...' : 'Eliminar finca y todos sus datos'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function FarmsPage() {
  return <FarmManagementPanel />;
}
