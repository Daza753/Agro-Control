import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Users, UserPlus, Shield, Loader2 } from 'lucide-react';
import type { Profile } from '../lib/auth';
import { apiRequest, getActiveFarmId } from '../lib/api';
import type { Farm } from '../lib/types';
import { Modal, Field, TextInput, Select, Button, Badge, EmptyState, ConfirmDialog } from '../components/ui';
import { useAuth } from '../lib/auth';
import { ImageUploadField } from '../components/ImageUploadField';

export function UsersPage() {
  const { profile: currentProfile, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'trabajador',
    password: '',
    active: true,
    farm_id: getActiveFarmId() ?? '',
    photo_url: null as string | null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userProfiles, farmRows] = await Promise.all([
        apiRequest<Profile[]>('/api/auth/users/'),
        apiRequest<Farm[]>('/api/auth/farms/'),
      ]);
      setProfiles(userProfiles);
      setFarms(farmRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({
      email: '',
      full_name: '',
      role: 'trabajador',
      password: '',
      active: true,
      farm_id: getActiveFarmId() ?? farms[0]?.id ?? '',
      photo_url: null,
    });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Profile) => {
    setEditing(p);
    setForm({
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      password: '',
      active: p.active,
      farm_id: p.farm_id ?? '',
      photo_url: p.photo_url ?? null,
    });
    setError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const path = editing ? `/api/auth/users/${editing.id}/` : '/api/auth/users/';
      const payload = editing
        ? {
            full_name: form.full_name.trim(),
            role: form.role,
            active: form.active,
            farm_id: form.role === 'trabajador' ? form.farm_id : null,
            photo_url: form.photo_url,
            ...(form.password ? { password: form.password } : {}),
          }
        : {
            email: form.email.trim(),
            full_name: form.full_name.trim(),
            role: form.role,
            active: form.active,
            farm_id: form.role === 'trabajador' ? form.farm_id : null,
            password: form.password,
            photo_url: form.photo_url,
          };
      await apiRequest(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setModalOpen(false);
      await load();
      if (editing?.id === currentProfile?.id) {
        await refreshProfile();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteError(null);
    try {
      await apiRequest(`/api/auth/users/${deleteId}/`, { method: 'DELETE' });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.');
      return;
    }

    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>Administra los usuarios del sistema</p>
        <Button onClick={openNew}><span className="flex items-center gap-2"><UserPlus size={18} /> Nuevo usuario</span></Button>
      </div>
      {error && !modalOpen && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title="No hay usuarios" />
      ) : (
        <div className="mt-grid">
          {profiles.map((p) => (
            <div key={p.id} className="mt-card group hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 overflow-hidden rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center text-emerald-700 font-semibold text-lg">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.full_name || p.email} className="h-full w-full object-cover" />
                  ) : p.full_name?.charAt(0).toUpperCase() ?? p.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex gap-1.5">
                  <Badge color={p.role === 'admin' ? 'green' : 'blue'}>
                    <span className="flex items-center gap-1">
                      {p.role === 'admin' && <Shield size={11} />}
                      {p.role}
                    </span>
                  </Badge>
                </div>
              </div>
              <h3 className="font-semibold truncate" style={{ fontSize: 'var(--mt-heading-size)', color: 'var(--mt-heading-color)' }}>{p.full_name || 'Sin nombre'}</h3>
              <p className="truncate" style={{ fontSize: 'var(--mt-text-size)', color: 'var(--mt-text-color)' }}>{p.email}</p>
              {p.role === 'trabajador' && (
                <p className="mt-1 truncate text-xs text-slate-500">
                  Finca: {p.farm_name || 'Sin asignar'}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge color={p.active ? 'green' : 'gray'}>{p.active ? 'Activo' : 'Inactivo'}</Badge>
                {p.id === currentProfile?.id && <Badge color="amber">Tú</Badge>}
              </div>
              <div className="mt-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(p)} className="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium flex items-center justify-center gap-1">
                  <Pencil size={13} /> Editar
                </button>
                {p.id !== currentProfile?.id && (
                  <button onClick={() => setDeleteId(p.id)} className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar usuario' : 'Nuevo usuario'}>
        <div className="space-y-4">
          <Field label="Nombre completo *">
            <TextInput value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Oscar Vega" />
          </Field>
          <Field label="Correo electrónico *">
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@finca.com" disabled={!!editing} />
          </Field>
          <ImageUploadField
            label="Foto o icono del usuario"
            value={form.photo_url}
            onChange={(photo_url) => setForm({ ...form, photo_url })}
          />
          <Field label={editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}>
            <TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            <span className="mt-1 block text-xs text-slate-500">
              Usa al menos 8 caracteres; evita contraseñas comunes o solo numéricas.
            </span>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rol *">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'trabajador' })}>
                <option value="trabajador">Trabajador</option>
                <option value="admin">Administrador</option>
              </Select>
            </Field>
            <Field label="Estado">
              <Select value={form.active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
            </Field>
          </div>
          {form.role === 'trabajador' && (
            <Field label="Finca asignada *">
              <Select
                value={form.farm_id}
                onChange={(event) => setForm({ ...form, farm_id: event.target.value })}
              >
                <option value="">Selecciona una finca</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </Select>
            </Field>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button
            onClick={save}
            disabled={
              saving
              || (form.role === 'trabajador' && !form.farm_id)
              || (!editing && (!form.email.trim() || !form.password))
            }
          >
            {saving ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Guardando</span> : 'Guardar'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar usuario"
        message="¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer."
        error={deleteError ?? undefined}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteId(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
