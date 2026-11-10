import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, EyeOff, RefreshCw, Wifi } from 'lucide-react';
import { TextInput } from './ui';
import {
  getActiveFarmId,
  getSyncMessage,
  isManualOfflineMode,
  refreshOfflineSnapshot,
  resolveOfflineConflict,
  setManualOfflineMode,
  subscribeSyncStatus,
  syncOfflineOperations,
} from '../lib/api';
import {
  getOfflineOperations,
  isOfflineSnapshotReady,
  OfflineOperation,
  OfflineStorageStatus,
  requestOfflineStoragePersistence,
  subscribeOffline,
} from '../lib/offline';
import { useAuth } from '../lib/auth';

interface OfflineStatusProps {
  presentation?: 'popover' | 'modal';
}

function isDuplicateAnimalCreate(operation: OfflineOperation) {
  return operation.status === 'rejected'
    && operation.method === 'POST'
    && operation.path === '/api/animals/'
    && operation.error?.toLocaleLowerCase().includes('chapeta ica ya está registrada');
}

export function OfflineStatus({ presentation = 'popover' }: OfflineStatusProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [manualOffline, setManualOffline] = useState(isManualOfflineMode());
  const [panelOpen, setPanelOpen] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [correctedTag, setCorrectedTag] = useState('');
  const [actionError, setActionError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [snapshotCreatedConfirmation, setSnapshotCreatedConfirmation] = useState(false);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<OfflineStorageStatus | null>(null);

  const load = useCallback(async () => {
    setOperations(await getOfflineOperations(userId, getActiveFarmId()));
    setMessage(getSyncMessage());
    setManualOffline(isManualOfflineMode(userId));
    const farmId = getActiveFarmId();
    setSnapshotReady(Boolean(userId && farmId && isOfflineSnapshotReady(userId, farmId)));
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const refresh = () => { void load(); };
    const updateOnline = () => setOnline(navigator.onLine);
    void requestOfflineStoragePersistence().then(setStorageStatus);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    const unsubscribeStorage = subscribeOffline(refresh);
    const unsubscribeSync = subscribeSyncStatus(refresh);
    void load();
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      unsubscribeStorage();
      unsubscribeSync();
    };
  }, [load, userId]);

  const resolve = async (
    operation: OfflineOperation,
    resolution: 'keep-local' | 'use-server' | 'edit-local' | 'delete',
    body?: Record<string, unknown>,
  ) => {
    setWorkingId(operation.id);
    setActionError('');
    try {
      await resolveOfflineConflict(operation, resolution, body);
      setEditingId(null);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo resolver el conflicto.');
    } finally {
      setWorkingId(null);
    }
  };

  const saveCorrectedTag = (operation: OfflineOperation) => {
    const tag = correctedTag.trim();
    if (!tag) {
      setActionError('Escribe una chapeta ICA para guardar el animal.');
      return;
    }
    if (tag === String(operation.body?.ica_code ?? '').trim()) {
      setActionError('Escribe una chapeta diferente a la que ya está registrada.');
      return;
    }
    void resolve(operation, 'edit-local', { ...operation.body, ica_code: tag });
  };

  const discardRejectedChange = (operation: OfflineOperation) => {
    if (window.confirm('Se descartará este cambio guardado en el dispositivo y no se enviará a la finca. ¿Deseas continuar?')) {
      void resolve(operation, 'use-server');
    }
  };

  const confirmDelete = (operation: OfflineOperation) => {
    const target = operation.method === 'POST'
      ? 'Se eliminará el registro local pendiente y no se enviará al servidor.'
      : 'Se solicitará eliminar el registro también de la base de datos al sincronizar.';
    if (window.confirm(`${target} Esta acción no se puede deshacer. ¿Deseas continuar?`)) {
      void resolve(operation, 'delete');
    }
  };

  const toggleManualOffline = () => {
    const next = !manualOffline;
    setManualOffline(next);
    setManualOfflineMode(next);
    setActionError('');
  };

  const syncNow = async () => {
    setSyncing(true);
    setActionError('');
    try {
      await syncOfflineOperations(true);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo sincronizar con la base de datos.');
    } finally {
      setSyncing(false);
    }
  };

  const createOfflineCopy = async () => {
    const farmId = getActiveFarmId();
    if (!online) {
      setActionError('Conéctate a internet para descargar una copia offline de la finca.');
      return;
    }
    if (manualOffline) {
      setActionError('Selecciona “Reanudar conexión” antes de crear la copia offline.');
      return;
    }
    if (!farmId) {
      setActionError('Selecciona una finca antes de crear su copia offline.');
      return;
    }

    setCreatingSnapshot(true);
    setActionError('');
    setSnapshotCreatedConfirmation(false);
    try {
      const created = await refreshOfflineSnapshot(farmId);
      if (!created) {
        throw new Error('No se pudo completar la copia offline. Comprueba tu conexión e inténtalo de nuevo.');
      }
      await load();
      setMessage('Copia offline guardada en este dispositivo. Estará disponible al cerrar sesión o reiniciar el programa.');
      setSnapshotCreatedConfirmation(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo crear la copia offline.');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const queued = operations.filter((operation) => operation.status === 'queued').length;
  const conflicts = operations.filter((operation) => operation.status === 'conflict').length;
  const rejected = operations.filter((operation) => operation.status === 'rejected').length;
  const offlineActive = !online || manualOffline;
  const isSyncing = syncing || message === 'Sincronizando cambios…';

  useEffect(() => {
    if (!panelOpen || presentation !== 'modal') return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [panelOpen, presentation]);

  if (!userId) return null;

  return (
    <aside
      aria-live="polite"
      className={presentation === 'modal'
        ? 'relative'
        : 'relative z-20 max-h-[70vh] w-full overflow-y-auto sm:w-auto sm:min-w-56 sm:max-w-[30rem]'}
    >
      {!panelOpen ? (
        <button
          type="button"
          aria-expanded={panelOpen}
          aria-label={`Mostrar estado de conexión: ${offlineActive ? 'Sin conexión' : 'En línea'}`}
          onClick={() => setPanelOpen(true)}
          className={presentation === 'modal'
            ? `inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${
              offlineActive
                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'border-emerald-600 bg-emerald-700 text-white hover:bg-emerald-800'
            }`
            : `flex min-h-[3.5rem] w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left shadow-lg transition-colors sm:w-56 ${
              offlineActive
                ? 'border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100'
                : 'border-emerald-500 bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
        >
          <span className={`flex items-center ${presentation === 'modal' ? 'gap-2' : 'gap-3'}`}>
            {offlineActive ? <CloudOff size={presentation === 'modal' ? 18 : 22} /> : <Wifi size={presentation === 'modal' ? 18 : 22} />}
            <span className={presentation === 'modal' ? '' : 'text-base font-bold'}>
              {presentation === 'modal'
                ? `Conexión: ${offlineActive ? 'Sin conexión' : 'En línea'}`
                : offlineActive ? 'Sin conexión' : 'En línea'}
            </span>
          </span>
          {queued + conflicts + rejected > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              offlineActive ? 'bg-amber-200 text-amber-950' : 'bg-white/20 text-white'
            }`}>
              {queued + conflicts + rejected}
            </span>
          )}
        </button>
      ) : (
      <div
        className={presentation === 'modal'
          ? 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4'
          : ''}
        onMouseDown={presentation === 'modal' ? () => setPanelOpen(false) : undefined}
      >
      <div
        role={presentation === 'modal' ? 'dialog' : undefined}
        aria-modal={presentation === 'modal' ? true : undefined}
        aria-label={presentation === 'modal' ? 'Estado de conexión' : undefined}
        className={presentation === 'modal'
          ? 'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-3 shadow-2xl'
          : ''}
        onMouseDown={presentation === 'modal' ? (event) => event.stopPropagation() : undefined}
      >
      {presentation === 'modal' && (
        <h2 className="mb-3 px-1 text-lg font-semibold text-slate-800">Estado de conexión</h2>
      )}
      <div className="space-y-3">
      <section className={`rounded-xl border p-3 shadow-lg ${offlineActive ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-300 bg-white text-slate-800'}`}>
        <div className="flex flex-col gap-3">
          <div
            role="status"
            className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 sm:w-56 ${
              offlineActive ? 'bg-amber-100 text-amber-900' : 'bg-emerald-700 text-white'
            }`}
          >
            <span className="flex items-center gap-2 text-lg font-bold">
              {offlineActive ? <CloudOff size={22} /> : <Wifi size={22} />}
              {offlineActive ? 'Sin conexión' : 'En línea'}
            </span>
          </div>
          <div className="min-w-0">
            {snapshotCreatedConfirmation && (
              <div role="status" className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
                <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Copia offline creada correctamente</p>
                  <p className="mt-1 text-xs">Se guardó en este dispositivo y estará disponible después de cerrar sesión o reiniciar el programa.</p>
                  <button
                    type="button"
                    onClick={() => setSnapshotCreatedConfirmation(false)}
                    className="mt-2 rounded-md border border-emerald-700 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
            <p className="mt-0.5 text-xs">
              {!online
                ? 'Sin internet: los cambios compatibles se guardan en este equipo. Para descargar la copia offline, conéctate primero.'
                : manualOffline
                  ? 'La aplicación permanecerá offline aunque haya internet. Al reanudar, sincronizará los cambios pendientes.'
                  : queued
                    ? `${queued} cambio(s) pendientes de subir a la base de datos.`
                    : snapshotReady
                      ? 'La copia offline está guardada en este dispositivo y se conserva al cerrar sesión o reiniciar el programa.'
                      : 'Todavía no hay una copia offline completa de esta finca.'}
              {conflicts ? ` · ${conflicts} conflicto(s) para resolver` : ''}
              {rejected ? ` · ${rejected} cambio(s) rechazado(s)` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleManualOffline}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${manualOffline ? 'bg-amber-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
              >
                {manualOffline
                  ? 'Reanudar conexión'
                  : offlineActive ? 'Mantener modo offline' : 'Activar modo offline'}
              </button>
              <button
                type="button"
                onClick={() => void createOfflineCopy()}
                disabled={!online || manualOffline || creatingSnapshot || !getActiveFarmId()}
                aria-busy={creatingSnapshot}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={13} className={creatingSnapshot ? 'animate-spin' : ''} />
                {creatingSnapshot ? 'Guardando copia…' : 'Crear copia offline'}
              </button>
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={!online || manualOffline || isSyncing}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Sincronizando…' : 'Sincronizar ahora'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <EyeOff size={15} />
              Ocultar panel
            </button>
            <p className={`mt-2 text-xs ${storageStatus === 'persistent' ? 'text-emerald-700' : 'text-amber-800'}`}>
              {storageStatus === 'persistent'
                ? 'Almacenamiento local persistente solicitado. No protege contra fallos del disco ni borrar los datos del sitio.'
                : storageStatus === 'best-effort'
                  ? 'El navegador puede desalojar los datos locales. No borres los datos del sitio.'
                  : storageStatus === 'unsupported'
                    ? 'Este entorno no confirma protección contra el desalojo automático de datos.'
                    : 'Verificando protección de los datos locales…'}
            </p>
            {message && (
              <p role="status" className={`mt-2 break-words text-xs ${message.startsWith('Datos subidos') || message.startsWith('Base de datos actualizada') ? 'text-emerald-800' : 'text-amber-800'}`}>
                {message}
              </p>
            )}
            {actionError && <p role="alert" className="mt-2 break-words text-xs font-medium text-red-700">{actionError}</p>}
          </div>
        </div>
      </section>

      {operations.filter((operation) => operation.status !== 'queued').map((operation) => (
        <section key={operation.id} className="rounded-xl border border-orange-300 bg-white p-3 text-slate-800 shadow-lg">
          <div className="flex items-start gap-2">
            {operation.status === 'conflict'
              ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-orange-600" />
              : <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-red-600" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {operation.status === 'conflict'
                  ? 'Conflicto de edición'
                  : isDuplicateAnimalCreate(operation) ? 'La chapeta ya está registrada' : 'No se pudo guardar el cambio'}
              </p>
              <p className="mt-1 break-words text-xs text-slate-600">
                {isDuplicateAnimalCreate(operation)
                  ? 'Ese número de chapeta ya pertenece a un animal de esta finca. Cambia la chapeta para guardar este animal.'
                  : operation.error}
              </p>
              {operation.status === 'conflict' && (
                <p className="mt-2 text-xs text-slate-600">
                  El registro cambió mientras trabajabas. Elige si quieres volver a guardar lo que hiciste aquí o quedarte con la información que ya está guardada.
                </p>
              )}
              {editingId === operation.id && isDuplicateAnimalCreate(operation) && (
                <div className="mt-3 space-y-2">
                  <label htmlFor={`correct-tag-${operation.id}`} className="block text-xs font-medium text-slate-700">
                    Nueva chapeta ICA
                  </label>
                  <TextInput
                    id={`correct-tag-${operation.id}`}
                    value={correctedTag}
                    onChange={(event) => setCorrectedTag(event.target.value)}
                    placeholder="Escribe una chapeta diferente"
                    maxLength={100}
                  />
                  <button
                    type="button"
                    disabled={workingId === operation.id}
                    onClick={() => saveCorrectedTag(operation)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Guardar y volver a intentar
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {operation.status === 'conflict' && (
                  <>
                    <button
                      type="button"
                      disabled={workingId === operation.id}
                      onClick={() => void resolve(operation, 'keep-local')}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Guardar mis cambios
                    </button>
                    <button
                      type="button"
                      disabled={workingId === operation.id}
                      onClick={() => void resolve(operation, 'use-server')}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Conservar lo que ya está guardado
                    </button>
                    <button
                      type="button"
                      disabled={workingId === operation.id}
                      onClick={() => confirmDelete(operation)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      Eliminar registro
                    </button>
                  </>
                )}
                {operation.status === 'rejected' && (
                  <>
                    <button
                      type="button"
                      disabled={workingId === operation.id}
                      onClick={() => {
                        if (isDuplicateAnimalCreate(operation)) {
                          setCorrectedTag(String(operation.body?.ica_code ?? ''));
                        }
                        setEditingId(editingId === operation.id ? null : operation.id);
                        setActionError('');
                      }}
                      className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      {isDuplicateAnimalCreate(operation) ? 'Cambiar chapeta' : 'Volver a intentar'}
                    </button>
                    <button
                      type="button"
                      disabled={workingId === operation.id}
                      onClick={() => discardRejectedChange(operation)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Descartar cambio
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}
      </div>
      </div>
      </div>
      )}
    </aside>
  );
}
