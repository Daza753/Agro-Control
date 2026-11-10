import {
  applyServerResult,
  cacheResponse,
  cancelQueuedOperation,
  clearOfflineFarm,
  findQueuedOperation,
  findCachedRecord,
  getOfflineIdentity,
  getOfflineUserId,
  getTokenOwnerId,
  getOfflineOperations,
  notifyOfflineChange,
  OfflineOperation,
  queueOfflineOperation,
  readCachedResponse,
  requestOfflineStoragePersistence,
  replaceCachedResponses,
  removeOfflineOperation,
  setOfflineSnapshotReady,
  subscribeOffline,
  updateOfflineOperation,
  updateCachedAccountList,
} from './offline';

const API_URL = (
  import.meta.env.VITE_API_URL?.trim()
  || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
).replace(/\/$/, '');
const SESSION_STORAGE_KEY = 'finca-control-auth';
const LEGACY_ACTIVE_FARM_STORAGE_KEY = 'finca-control-active-farm';
const MANUAL_OFFLINE_STORAGE_PREFIX = 'finca-control-manual-offline:';
const QUEUEABLE_RESOURCES = new Set([
  'animals', 'animal-categories', 'milk-production', 'vaccines', 'daily-activities',
  'disease-reports', 'medications', 'inputs', 'equipment', 'crops', 'fish-farming',
  'farm-settings', 'module-themes',
]);

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface ApiUser {
  id: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  profile: {
    id: string;
    full_name: string;
    role: 'admin' | 'trabajador';
    active: boolean;
    farm_id: string | null;
    photo_url: string | null;
  };
}

export function getActiveFarmId(): string | null {
  const userId = getOfflineUserId();
  return localStorage.getItem(userId ? `finca-control-active-farm:${userId}` : LEGACY_ACTIVE_FARM_STORAGE_KEY)
    ?? localStorage.getItem(LEGACY_ACTIVE_FARM_STORAGE_KEY);
}

export function isManualOfflineMode(userId = getOfflineUserId()) {
  return Boolean(userId && localStorage.getItem(`${MANUAL_OFFLINE_STORAGE_PREFIX}${userId}`) === 'true');
}

export function setManualOfflineMode(enabled: boolean) {
  const userId = getOfflineUserId();
  if (!userId) throw new Error('Inicia sesión antes de cambiar el modo offline.');
  const key = `${MANUAL_OFFLINE_STORAGE_PREFIX}${userId}`;
  if (enabled) localStorage.setItem(key, 'true');
  else localStorage.removeItem(key);
  notifySyncStatus(enabled ? 'Modo offline activado. Los cambios se guardarán en este equipo.' : '');
  if (!enabled) void syncOfflineOperations(true);
}

export function setActiveFarmId(farmId: string | null) {
  const userId = getOfflineUserId();
  const key = userId ? `finca-control-active-farm:${userId}` : LEGACY_ACTIVE_FARM_STORAGE_KEY;
  if (farmId) localStorage.setItem(key, farmId);
  else localStorage.removeItem(key);
  notifyOfflineChange();
}

export function getStoredTokens(): TokenPair | null {
  const ownerId = getTokenOwnerId();
  if (ownerId && getOfflineUserId() && ownerId !== getOfflineUserId()) return null;
  const value = localStorage.getItem(SESSION_STORAGE_KEY) ?? sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!value) return null;
  try {
    const tokens = JSON.parse(value) as Partial<TokenPair>;
    return typeof tokens.access === 'string' && typeof tokens.refresh === 'string'
      ? { access: tokens.access, refresh: tokens.refresh }
      : null;
  } catch (error) {
    console.error('No se pudo leer la sesión local.', error);
    return null;
  }
}

export function storeTokens(tokens: TokenPair | null) {
  if (tokens) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

async function refreshAccessToken(refresh: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    storeTokens(null);
    throw new Error('La sesión venció. Inicia sesión nuevamente.');
  }
  const data = await response.json() as { access: string };
  storeTokens({ refresh, access: data.access });
  return data.access;
}

async function readError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as
    | { detail?: string; [key: string]: unknown }
    | null;
  const detail = body?.detail ?? Object.values(body ?? {}).flat().find(
    (value): value is string => typeof value === 'string',
  );
  return new Error(detail ?? `Error de API (${response.status}).`);
}

export class OfflineDataUnavailableError extends Error {
  constructor(path: string) {
    super(`No hay una copia offline de ${path}. Conéctate y sincroniza los datos antes de usar este registro.`);
    this.name = 'OfflineDataUnavailableError';
  }
}

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError;
}

async function getOfflineData<T>(path: string, farmId: string | null): Promise<T> {
  const derived = await deriveOfflineResponse<T>(path, farmId);
  if (derived !== undefined) return derived;
  const cached = await readCachedResponse<T>(path, path.startsWith('/api/auth/') ? null : farmId);
  if (cached !== undefined) return cached;
  throw new OfflineDataUnavailableError(path);
}

const OFFLINE_QUERY_RULES: Record<string, {
  filters: string[];
  searches?: string[];
  ordering: string[];
  defaultOrdering?: string[];
  limit?: number;
}> = {
  animals: { filters: ['species', 'category', 'active'], searches: ['ica_code', 'breed'], ordering: ['ica_code'] },
  'animal-categories': { filters: [], ordering: ['label'] },
  'milk-production': { filters: ['date_from', 'date_to'], searches: ['animal.ica_code'], ordering: ['date', 'created_at'], defaultOrdering: ['-date', '-created_at'] },
  vaccines: { filters: ['status', 'scheduled_date'], ordering: ['scheduled_date', 'created_at', 'status'], defaultOrdering: ['scheduled_date'] },
  'daily-activities': { filters: ['date', 'activity_type'], ordering: ['date', 'created_at'], defaultOrdering: ['-date', '-created_at'], limit: 100 },
  'disease-reports': { filters: ['status', 'report_date'], ordering: ['report_date', 'created_at', 'status'], defaultOrdering: ['-report_date', '-created_at'] },
  medications: { filters: ['type'], searches: ['name', 'supplier', 'type'], ordering: ['name', 'created_at', 'quantity', 'expiry_date'], defaultOrdering: ['-created_at'] },
  inputs: { filters: ['type'], searches: ['name', 'supplier', 'type'], ordering: ['name', 'created_at', 'purchase_date', 'quantity'], defaultOrdering: ['-created_at'] },
  equipment: { filters: ['status'], searches: ['name', 'type'], ordering: ['name', 'created_at', 'status'], defaultOrdering: ['-created_at'] },
  crops: { filters: ['status'], searches: ['name', 'type'], ordering: ['name', 'created_at', 'status'], defaultOrdering: ['-created_at'] },
  'fish-farming': { filters: ['status'], searches: ['pond_name', 'species'], ordering: ['pond_name', 'created_at', 'status'], defaultOrdering: ['-created_at'] },
  'farm-settings': { filters: [], ordering: ['id'] },
  'module-access': { filters: [], ordering: ['module_key'] },
  'module-themes': { filters: [], ordering: ['module_key', 'updated_at'], defaultOrdering: ['module_key'] },
};

async function deriveOfflineResponse<T>(path: string, farmId: string | null): Promise<T | undefined> {
  const match = /^\/api\/([a-z-]+)\/(?:([^/]+)\/)?(?:\?(.*))?$/.exec(path);
  if (!match) return undefined;
  const [, resource, recordId, search] = match;
  const collectionPath = `/api/${resource}/`;
  const cached = await readCachedResponse<unknown>(collectionPath, farmId);
  const userId = getOfflineUserId();
  const pending = userId
    ? (await getOfflineOperations(userId, farmId)).filter((operation) => (
      /^\/api\/([a-z-]+)\//.exec(operation.path)?.[1] === resource
    ))
    : [];
  if (!Array.isArray(cached) && pending.length === 0) return undefined;
  let rows = Array.isArray(cached) ? [...cached] as Array<Record<string, unknown>> : [];
  for (const operation of pending) {
    const operationId = operation.path.match(/^\/api\/[a-z-]+\/([^/]+)\/$/)?.[1] ?? operation.id;
    const index = rows.findIndex((row) => row.id === operationId);
    if (operation.method === 'DELETE') {
      if (index >= 0) rows.splice(index, 1);
      continue;
    }

    const value: Record<string, unknown> = {
      ...(operation.baseState ?? {}),
      ...(index >= 0 ? rows[index] : {}),
      ...(operation.body ?? {}),
      id: operationId,
      __offlineQueued: true,
      __offlineStatus: operation.status,
    };
    if (resource === 'animals' && operation.method === 'POST') {
      value.active ??= true;
      value.name ??= '';
      value.category ??= '';
      value.health_status ??= 'sano';
      value.created_at ??= operation.createdAt;
      value.updated_at ??= operation.createdAt;
    }
    if (resource === 'milk-production') {
      value.total_liters ??= Number(value.morning_liters ?? 0) + Number(value.afternoon_liters ?? 0);
    }
    if (index >= 0) rows[index] = value;
    else if (operation.method === 'POST') rows.unshift(value);
  }

  if (recordId) {
    return rows.find((item) => item.id === recordId) as T | undefined;
  }
  if (!search) return rows as T;
  const rules = OFFLINE_QUERY_RULES[resource];
  if (!rules) return undefined;
  const params = new URLSearchParams(search);
  const supported = new Set([...rules.filters, 'search', 'ordering']);
  if ([...params.keys()].some((key) => !supported.has(key))) return undefined;
  const searchTerm = params.get('search');
  if (searchTerm && searchTerm.length > 100) return undefined;
  const species = params.get('species');
  if (resource === 'animals' && species && species !== 'all' && ![
    'vaca', 'toro', 'ternero', 'caballo', 'cerdo', 'chivo', 'oveja',
    'equino', 'porcino', 'caprino', 'ovino', 'otro',
  ].includes(species)) return undefined;
  for (const dateKey of ['date_from', 'date_to']) {
    const dateValue = params.get(dateKey);
    if (dateValue && (
      resource !== 'milk-production'
      || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      || Number.isNaN(Date.parse(dateValue))
      || new Date(`${dateValue}T00:00:00Z`).toISOString().slice(0, 10) !== dateValue
    )) return undefined;
  }
  const active = params.get('active');
  if (resource === 'animals' && active && active !== 'true' && active !== 'false') return undefined;

  for (const [key, value] of params) {
    if (!value) continue;
    if (key === 'search') {
      if (!rules.searches?.length) return undefined;
      const needle = value.toLocaleLowerCase();
      rows = rows.filter((row) => rules.searches?.some((field) => {
        const found = field.split('.').reduce<unknown>((current, part) => (
          current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined
        ), row);
        return String(found ?? '').toLocaleLowerCase().includes(needle);
      }));
    } else if (key === 'date_from' || key === 'date_to') {
      if (resource !== 'milk-production') return undefined;
      rows = rows.filter((row) => typeof row.date === 'string'
        && (key === 'date_from' ? row.date >= value : row.date <= value));
    } else if (rules.filters.includes(key)) {
      if (resource === 'animals' && key === 'species' && value === 'all') continue;
      rows = rows.filter((row) => String(row[key] ?? '') === value);
    }
  }

  const requested = params.get('ordering');
  const orderings = requested ? [requested] : (rules.defaultOrdering ?? []);
  for (const ordering of [...orderings].reverse()) {
    const descending = ordering.startsWith('-');
    const field = descending ? ordering.slice(1) : ordering;
    if (!rules.ordering.includes(field)) return undefined;
    rows.sort((a, b) => {
      const left = a[field];
      const right = b[field];
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true });
      return descending ? -comparison : comparison;
    });
  }
  return (rules.limit ? rows.slice(0, rules.limit) : rows) as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  const farmId = getActiveFarmId();
  if (farmId && !headers.has('X-Farm-ID')) headers.set('X-Farm-ID', farmId);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const storedTokens = accessToken ? null : getStoredTokens();
  let token = accessToken ?? storedTokens?.access;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const method = (options.method ?? 'GET').toUpperCase();
  const safePath = path.split('?', 1)[0];
  if (!navigator.onLine || isManualOfflineMode()) {
    if (method === 'GET') return getOfflineData<T>(path, farmId);
    if (safePath.startsWith('/api/auth/')) {
      throw new Error('Esta operación requiere conexión y no se guardará offline.');
    }
    return queueRequest<T>(path, method, options, farmId);
  }
  if (!API_URL) {
    if (method === 'GET') return getOfflineData<T>(path, farmId);
    throw new Error('No se configuró la dirección del servicio de FincaControl para esta versión.');
  }
  if (isQueueableWrite(safePath, method)) {
    return submitOnlineWrite<T>(safePath, method, options, farmId);
  }

  try {
    let response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (response.status === 401 && storedTokens?.refresh && !accessToken) {
      token = await refreshAccessToken(storedTokens.refresh);
      headers.set('Authorization', `Bearer ${token}`);
      response = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
    if (!response.ok) throw await readError(response);
    if (response.status === 204) {
      if (method !== 'GET') await updateOnlineCache(safePath, method, farmId, null);
      return undefined as T;
    }
    const data = await response.json() as T;
    if (method === 'GET' && path !== '/api/sync/snapshot/') {
      try {
        await cacheResponse(path, data, path.startsWith('/api/auth/') ? null : farmId);
      } catch (cacheError) {
        console.warn('La respuesta se recibió, pero no se pudo guardar para uso offline.', cacheError);
      }
    } else {
      await updateOnlineCache(safePath, method, farmId, data);
    }
    return data;
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    if (method === 'GET') return getOfflineData<T>(path, farmId);
    if (safePath.startsWith('/api/auth/')) throw new Error('Esta operación requiere conexión y no se guardará offline.');
    return queueRequest<T>(path, method, options, farmId);
  }
}

async function updateOnlineCache(path: string, method: string, farmId: string | null, data: unknown) {
  const accountMatch = /^\/api\/auth\/(farms|users)\/(?:([^/]+)\/)?$/.exec(path);
  if (accountMatch) {
    try {
      await updateCachedAccountList(
        `/api/auth/${accountMatch[1]}/`,
        method,
        accountMatch[2],
        data,
      );
      if (accountMatch[1] === 'farms' && method === 'DELETE' && accountMatch[2]) {
        const userId = getOfflineUserId();
        if (userId) await clearOfflineFarm(userId, accountMatch[2]);
      }
    } catch (error) {
      console.warn('No se pudo actualizar la copia offline de esta lista.', error);
    }
    return;
  }
  const resourceMatch = /^\/api\/([a-z-]+)\/(?:([^/]+)\/)?$/.exec(path);
  const resource = resourceMatch?.[1];
  const userId = getOfflineUserId();
  if (!resource || (!QUEUEABLE_RESOURCES.has(resource) && resource !== 'module-access') || !userId || !farmId) return;
  try {
    const record = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown> : null;
    const id = resourceMatch?.[2] ?? (method === 'POST' && typeof record?.id === 'string' ? record.id : crypto.randomUUID());
    await applyServerResult({
      id,
      userId,
      farmId,
      path,
      method: method as OfflineOperation['method'],
      body: record,
      baseState: null,
      status: 'queued',
      createdAt: new Date().toISOString(),
    }, record);
  } catch (error) {
    console.warn('No se pudo actualizar la copia offline de este registro.', error);
  }
}

async function queueRequest<T>(
  path: string,
  method: string,
  options: RequestInit,
  farmId: string | null,
): Promise<T> {
  const prepared = await prepareOfflineOperation(path, method, options, farmId, false, true);
  if (prepared.cancelCreate) {
    await cancelQueuedOperation(prepared.operation.id, prepared.operation);
    return undefined as T;
  }
  await queueOfflineOperation(prepared.operation);
  for (const operationId of prepared.supersededOperationIds) {
    await removeOfflineOperation(operationId);
  }
  if (method === 'DELETE') return undefined as T;
  return {
    ...(prepared.operation.baseState ?? {}),
    ...(prepared.operation.body ?? {}),
    id: prepared.recordId ?? prepared.operation.id,
    __offlineQueued: true,
  } as T;
}

function isQueueableWrite(path: string, method: string) {
  const resource = /^\/api\/([a-z-]+)\//.exec(path)?.[1];
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    && Boolean(resource && QUEUEABLE_RESOURCES.has(resource));
}

async function prepareOfflineOperation(
  path: string,
  method: string,
  options: RequestInit,
  farmId: string | null,
  fetchBase: boolean,
  mergePending: boolean,
) {
  if (
    path.startsWith('/api/auth/users/')
    || path.startsWith('/api/auth/farms/')
    || path.includes('/password/')
    || path.startsWith('/api/module-access/')
  ) {
    throw new Error('La gestión de usuarios, contraseñas, permisos y eliminación de fincas requiere conexión.');
  }
  const match = /^\/api\/([a-z-]+)\/(?:([0-9a-fA-F-]{36})\/)?(?:\?.*)?$/.exec(path);
  const resource = match?.[1];
  const recordId = match?.[2];
  const userId = getOfflineUserId();
  if (
    !match || !resource || !QUEUEABLE_RESOURCES.has(resource) || !userId || !farmId
    || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  ) {
    throw new Error('Esta operación no se puede guardar offline.');
  }
  if ((method === 'POST') === Boolean(recordId)) {
    throw new Error('La ruta de este cambio no se puede guardar offline.');
  }
  let body: Record<string, unknown> | null = null;
  if (method !== 'DELETE') {
    try {
      body = JSON.parse(String(options.body ?? '{}')) as Record<string, unknown>;
    } catch {
      throw new Error('El formato de este cambio no se puede guardar offline.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('El formato de este cambio no se puede guardar offline.');
    }
    if (containsSensitiveField(body)) {
      throw new Error('Los datos de contraseña o credenciales nunca se guardan en la cola offline.');
    }
    if (method === 'POST') delete body.id;
  }

  const collectionPath = `/api/${resource}/`;
  let baseState = recordId ? await findCachedRecord(collectionPath, farmId, recordId) : null;
  if (recordId && !baseState && fetchBase) {
    await apiRequest<Record<string, unknown>>(`${collectionPath}${recordId}/`);
    baseState = await findCachedRecord(collectionPath, farmId, recordId);
  }
  if (recordId && !baseState) throw new OfflineDataUnavailableError(`${collectionPath}${recordId}/`);

  const pendingOperations = mergePending && recordId && method === 'DELETE'
    ? (await getOfflineOperations(userId, farmId)).filter((operation) => {
      const operationResource = /^\/api\/([a-z-]+)\//.exec(operation.path)?.[1];
      const operationRecordId = operation.path.match(/^\/api\/[a-z-]+\/([^/]+)\/$/)?.[1]
        ?? (operation.method === 'POST' ? operation.id : undefined);
      return operationResource === resource && operationRecordId === recordId;
    })
    : [];
  const pending = mergePending && recordId
    ? method === 'DELETE'
      ? pendingOperations.find((operation) => operation.method === 'POST') ?? pendingOperations[0] ?? null
      : await findQueuedOperation(userId, farmId, resource, recordId)
    : null;
  const pendingLocalCreate = Boolean(
    pending?.method === 'POST'
    && !pending.baseState
    && baseState?.__offlineQueued === true,
  );
  const supersededOperationIds = method === 'DELETE'
    ? pendingOperations.map((operation) => operation.id)
    : pending?.method === 'POST' && !pendingLocalCreate
      && Boolean(baseState) && baseState?.__offlineQueued !== true
      ? [pending.id]
      : [];
  const operationId = pendingLocalCreate && pending
    ? pending.id
    : pending && !supersededOperationIds.includes(pending.id) ? pending.id : crypto.randomUUID();
  const operation: OfflineOperation = pending
    ? {
      ...pending,
      path: pendingLocalCreate ? collectionPath : pending.method === 'POST'
        ? path.split('?', 1)[0] : pending.path,
      method: pendingLocalCreate ? 'POST' : method as OfflineOperation['method'],
      body: method === 'DELETE' ? null : { ...(pending.body ?? {}), ...(body ?? {}) },
      baseState: pendingLocalCreate ? null : method === 'DELETE'
        ? pending.serverState ?? pending.baseState ?? baseState
        : pending.baseState ?? baseState,
      id: operationId,
      status: 'queued',
      error: undefined,
      serverState: undefined,
    }
    : {
      id: operationId,
      userId,
      farmId,
      path: path.split('?', 1)[0],
      method: method as OfflineOperation['method'],
      body,
      baseState,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
  return {
    operation,
    recordId: recordId ?? (pending?.method === 'POST' ? pending.id : undefined),
    cancelCreate: pendingLocalCreate && method === 'DELETE',
    supersededOperationIds,
  };
}

async function submitOnlineWrite<T>(
  path: string,
  method: string,
  options: RequestInit,
  farmId: string | null,
): Promise<T> {
  const userId = getOfflineUserId();
  const recordId = /^\/api\/[a-z-]+\/([^/]+)\/$/.exec(path)?.[1];
  if (recordId && userId && farmId && method !== 'DELETE') {
    const resource = /^\/api\/([a-z-]+)\//.exec(path)?.[1] ?? '';
    const pending = (await getOfflineOperations(userId, farmId)).filter((operation) => {
      const operationResource = /^\/api\/([a-z-]+)\//.exec(operation.path)?.[1];
      const operationRecordId = /^\/api\/[a-z-]+\/([^/]+)\/$/.exec(operation.path)?.[1]
        ?? (operation.method === 'POST' ? operation.id : undefined);
      return operationResource === resource && operationRecordId === recordId
        && (operation.status === 'queued' || (operation.method === 'POST' && operation.status === 'rejected'));
    });
    if (pending.length) {
      const hasRejectedChange = pending.some((operation) => operation.status === 'rejected');
      if (!hasRejectedChange) {
        await syncOfflineOperations();
        const unresolved = (await getOfflineOperations(userId, farmId)).filter((operation) => {
          const operationResource = /^\/api\/([a-z-]+)\//.exec(operation.path)?.[1];
          const operationRecordId = /^\/api\/[a-z-]+\/([^/]+)\/$/.exec(operation.path)?.[1]
            ?? (operation.method === 'POST' ? operation.id : undefined);
          return operationResource === resource && operationRecordId === recordId;
        });
        if (unresolved.length) {
          throw new Error('Hay un cambio local pendiente para este registro. Sincronízalo o resuelve el conflicto antes de volver a editar.');
        }
      }
    }
  }

  const prepared = await prepareOfflineOperation(path, method, options, farmId, true, true);
  if (prepared.cancelCreate) {
    await cancelQueuedOperation(prepared.operation.id, prepared.operation);
    for (const operationId of prepared.supersededOperationIds) {
      if (operationId !== prepared.operation.id) await removeOfflineOperation(operationId);
    }
    return undefined as T;
  }
  try {
    const result = await sendSyncOperation(prepared.operation);
    if (result.status !== 'applied') {
      const operationState: OfflineOperation = {
        ...prepared.operation,
        status: result.status === 'conflict' ? 'conflict' : 'rejected',
        error: typeof result.error === 'string' ? result.error : 'El servidor rechazó el cambio.',
        serverState: result.server && typeof result.server === 'object'
          ? result.server as Record<string, unknown> : undefined,
      };
      await updateOfflineOperation(operationState);
      for (const operationId of prepared.supersededOperationIds) {
        await removeOfflineOperation(operationId);
      }
      throw new Error(operationState.error);
    }
    const data = result.data && typeof result.data === 'object'
      ? result.data as Record<string, unknown> : null;
    await removeOfflineOperation(prepared.operation.id);
    for (const operationId of prepared.supersededOperationIds) {
      await removeOfflineOperation(operationId);
    }
    await applyServerResult(prepared.operation, data);
    window.dispatchEvent(new CustomEvent('finca-data-synced', {
      detail: { farmIds: farmId ? [farmId] : [] },
    }));
    return data as T;
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    await queueOfflineOperation(prepared.operation);
    for (const operationId of prepared.supersededOperationIds) {
      await removeOfflineOperation(operationId);
    }
    if (method === 'DELETE') return undefined as T;
    return {
      ...(prepared.operation.baseState ?? {}),
      ...(prepared.operation.body ?? {}),
      id: prepared.recordId ?? prepared.operation.id,
      __offlineQueued: true,
    } as T;
  }
}

async function sendSyncOperation(operation: OfflineOperation) {
  const tokens = getStoredTokens();
  if (!tokens?.refresh) throw new Error('Vuelve a iniciar sesión con conexión antes de sincronizar cambios.');
  let access = tokens.access;
  if (!access) access = await refreshAccessToken(tokens.refresh);
  const send = (bearer: string) => fetch(`${API_URL}/api/sync/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
      'X-Farm-ID': operation.farmId,
    },
    body: JSON.stringify({
      operations: [{
        id: operation.id,
        farm_id: operation.farmId,
        method: operation.method,
        path: operation.path,
        body: operation.body,
        base_state: operation.baseState,
      }],
    }),
  });
  let response = await send(access);
  if (response.status === 401) {
    access = await refreshAccessToken(tokens.refresh);
    response = await send(access);
  }
  if (!response.ok) throw await readError(response);
  const payload = await response.json() as { results?: Array<Record<string, unknown>> };
  const result = payload.results?.[0];
  if (payload.results?.length !== 1 || result?.id !== operation.id || typeof result.status !== 'string') {
    throw new Error('El servidor devolvió una respuesta de sincronización no válida.');
  }
  return result as { id: string; status: string; data?: unknown; error?: string; server?: unknown };
}

function containsSensitiveField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => /password|credential|secret/i.test(key) || containsSensitiveField(child));
}

export async function refreshOfflineSnapshot(requestedFarmId = getActiveFarmId()) {
  const userId = getOfflineUserId();
  const farmId = requestedFarmId;
  if (!userId || !farmId || !navigator.onLine) return false;
  await requestOfflineStoragePersistence();
  const snapshot = await apiRequest<{
    farm_id: string;
    resources: Record<string, unknown>;
  }>('/api/sync/snapshot/', { headers: { 'X-Farm-ID': farmId } });
  const requiredResources = [
    '/api/animals/', '/api/animal-categories/', '/api/milk-production/', '/api/vaccines/',
    '/api/vaccines/medication-options/', '/api/daily-activities/', '/api/disease-reports/',
    '/api/medications/', '/api/inputs/', '/api/equipment/', '/api/crops/', '/api/fish-farming/',
    '/api/farm-settings/', '/api/module-access/', '/api/module-themes/',
  ];
  if (snapshot.farm_id !== farmId || !snapshot.resources) {
    throw new Error('La descarga offline pertenece a otra finca o está incompleta.');
  }
  for (const path of requiredResources) {
    if (!Array.isArray(snapshot.resources[path])) {
      throw new Error(`No se pudo descargar la copia offline de ${path}.`);
    }
  }
  const identity = getOfflineIdentity(userId);
  const cachedResources: Array<{ path: string; data: unknown; farmId: string | null }> = requiredResources.map((path) => ({
    path,
    data: snapshot.resources[path],
    farmId,
  }));
  cachedResources.push({ path: '/api/sync/snapshot/', data: snapshot, farmId });
  if (identity?.user.profile.role === 'admin') {
    const users = await apiRequest<unknown[]>('/api/auth/users/');
    if (!Array.isArray(users)) throw new Error('No se pudo descargar la lista offline de usuarios.');
    cachedResources.push({ path: '/api/auth/users/', data: users, farmId: null });
  }
  await replaceCachedResponses(cachedResources, userId);
  setOfflineSnapshotReady(userId, farmId, true);
  return true;
}

export function getApiUrl() {
  return API_URL;
}

let syncInProgress = false;
let syncMessage = '';
const syncListeners = new Set<() => void>();

export function subscribeSyncStatus(listener: () => void) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncStatus(message = syncMessage) {
  syncMessage = message;
  syncListeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent('finca-sync-status'));
}

export function getSyncMessage() {
  return syncMessage;
}

export async function syncOfflineOperations(refreshAllSnapshots = false) {
  if (syncInProgress || !navigator.onLine || isManualOfflineMode()) return;
  const userId = getOfflineUserId();
  const tokens = getStoredTokens();
  const identity = getOfflineIdentity(userId);
  if (!userId || !identity || !tokens?.refresh) return;

  syncInProgress = true;
  notifySyncStatus('Sincronizando cambios…');
  try {
    let access = tokens.access;
    if (!access) access = await refreshAccessToken(tokens.refresh);
    const pending = (await getOfflineOperations(userId)).filter((item) => item.status === 'queued');
    let appliedCount = 0;
    let conflictCount = 0;
    let rejectedCount = 0;
    const farmIds = [...new Set([
      ...identity.farms.map((farm) => farm.id),
      ...pending.map((operation) => operation.farmId),
    ])];
    for (const farmId of farmIds) {
      const farmPending = pending.filter((operation) => operation.farmId === farmId);
      for (let index = 0; index < farmPending.length; index += 100) {
      const batch = farmPending.slice(index, index + 100);
      const send = (bearer: string) => fetch(`${API_URL}/api/sync/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
          'X-Farm-ID': farmId,
        },
        body: JSON.stringify({
          operations: batch.map((item) => ({
            id: item.id,
            farm_id: item.farmId,
            method: item.method,
            path: item.path,
            body: item.body,
            base_state: item.baseState,
          })),
        }),
      });

      let response = await send(access);
      if (response.status === 401) {
        access = await refreshAccessToken(tokens.refresh);
        response = await send(access);
      }
      if (!response.ok) throw await readError(response);
      const data = await response.json() as { results?: Array<Record<string, unknown>> };
      if (!Array.isArray(data.results) || data.results.length !== batch.length) {
        throw new Error('El servidor devolvió una respuesta de sincronización incompleta.');
      }

      for (let resultIndex = 0; resultIndex < data.results.length; resultIndex++) {
        const result = data.results[resultIndex];
        const operation = batch[resultIndex];
        if (result.id !== operation.id || typeof result.status !== 'string') {
          throw new Error('La respuesta de sincronización no coincide con los cambios enviados.');
        }
        if (result.status === 'applied') {
          appliedCount += 1;
          await removeOfflineOperation(operation.id);
          await applyServerResult(
            operation,
            result.data && typeof result.data === 'object'
              ? result.data as Record<string, unknown> : null,
          );
        } else {
          if (result.status === 'conflict') conflictCount += 1;
          else rejectedCount += 1;
          await updateOfflineOperation({
            ...operation,
            status: result.status === 'conflict' ? 'conflict' : 'rejected',
            error: typeof result.error === 'string' ? result.error : 'El servidor rechazó el cambio.',
            serverState: result.server && typeof result.server === 'object'
              ? result.server as Record<string, unknown> : undefined,
          });
        }
      }
      }
    }
    const snapshotFarmIds = refreshAllSnapshots
      ? identity.farms.map((farm) => farm.id)
      : [...new Set(pending.map((operation) => operation.farmId))];
    const snapshotErrors: string[] = [];
    for (const farmId of snapshotFarmIds) {
      try {
        await refreshOfflineSnapshot(farmId);
      } catch (error) {
        const farmName = identity.farms.find((farm) => farm.id === farmId)?.name ?? farmId;
        const detail = error instanceof Error ? error.message : 'Error desconocido.';
        snapshotErrors.push(`${farmName}: ${detail}`);
      }
    }
    if (appliedCount) {
      window.dispatchEvent(new CustomEvent('finca-data-synced', {
        detail: { farmIds: [...new Set(pending.map((operation) => operation.farmId))] },
      }));
    }
    const remaining = await getOfflineOperations(userId);
    const unresolvedConflicts = Math.max(
      conflictCount,
      remaining.filter((item) => item.status === 'conflict').length,
    );
    const unresolvedRejected = Math.max(
      rejectedCount,
      remaining.filter((item) => item.status === 'rejected').length,
    );
    if (snapshotErrors.length) {
      const appliedDetails = appliedCount
        ? `${appliedCount} cambio(s) sincronizado(s). `
        : '';
      notifySyncStatus(
        `Sincronización incompleta. ${appliedDetails}No se pudo actualizar la copia local: ${snapshotErrors.join(' · ')}`,
      );
    } else if (unresolvedConflicts || unresolvedRejected) {
      const details = [
        appliedCount ? `${appliedCount} cambio(s) subido(s) y vinculado(s)` : '',
        unresolvedConflicts ? `${unresolvedConflicts} conflicto(s) por resolver` : '',
        unresolvedRejected ? `${unresolvedRejected} cambio(s) rechazado(s)` : '',
      ].filter(Boolean).join('. ');
      notifySyncStatus(`Sincronización parcial. ${details}.`);
    } else if (appliedCount) {
      notifySyncStatus(`Datos subidos y vinculados correctamente (${appliedCount} cambio(s)).`);
    } else if (refreshAllSnapshots) {
      notifySyncStatus('Sin cambios nuevos. La copia de datos está actualizada.');
    } else {
      notifySyncStatus('');
    }
  } catch (error) {
    notifySyncStatus(error instanceof Error ? error.message : 'La sincronización no pudo completarse.');
  } finally {
    syncInProgress = false;
  }
}

export function startOfflineSync() {
  const sync = () => { void syncOfflineOperations(); };
  const refreshAfterReconnect = () => { void syncOfflineOperations(true); };
  window.addEventListener('online', refreshAfterReconnect);
  const unsubscribe = subscribeOffline(sync);
  const interval = window.setInterval(sync, 5000);
  sync();
  return () => {
    window.removeEventListener('online', refreshAfterReconnect);
    unsubscribe();
    window.clearInterval(interval);
  };
}

export async function resolveOfflineConflict(
  operation: OfflineOperation,
  resolution: 'keep-local' | 'use-server' | 'edit-local' | 'delete',
  editedBody?: Record<string, unknown>,
) {
  if (resolution === 'keep-local' || resolution === 'edit-local') {
    let method = operation.method;
    let path = operation.path;
    let baseState = operation.serverState ?? operation.baseState;
    const recordMatch = /^\/api\/([a-z-]+)\/([^/]+)\/$/.exec(operation.path);
    if (method !== 'POST' && !baseState && recordMatch) {
      const cached = await findCachedRecord(`/api/${recordMatch[1]}/`, operation.farmId, recordMatch[2]);
      if (cached?.__offlineQueued === true) {
        method = 'POST';
        path = `/api/${recordMatch[1]}/`;
        baseState = null;
      }
    }
    await updateOfflineOperation({
      ...operation,
      path,
      method,
      baseState,
      body: resolution === 'edit-local' ? editedBody ?? operation.body : operation.body,
      status: 'queued',
      error: undefined,
      serverState: undefined,
    });
    await syncOfflineOperations();
  } else if (resolution === 'delete' && operation.method !== 'POST') {
    await updateOfflineOperation({
      ...operation,
      method: 'DELETE',
      body: null,
      baseState: operation.serverState ?? operation.baseState,
      status: 'queued',
      error: undefined,
      serverState: undefined,
    });
    await syncOfflineOperations();
  } else {
    await removeOfflineOperation(operation.id);
    const serverState = operation.serverState ?? operation.baseState;
    await applyServerResult({ ...operation, method: 'DELETE', body: null }, null);
    if (serverState && typeof serverState.id === 'string') {
      await applyServerResult({
        ...operation,
        path: `${operation.path.replace(/\/$/, '')}/${serverState.id}/`,
        method: 'PATCH',
        body: serverState,
      }, serverState);
    }
  }
}
