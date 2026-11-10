export type OfflineOperationStatus = 'queued' | 'conflict' | 'rejected';

export interface OfflineOperation {
  id: string;
  userId: string;
  farmId: string;
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: Record<string, unknown> | null;
  baseState: Record<string, unknown> | null;
  status: OfflineOperationStatus;
  error?: string;
  serverState?: Record<string, unknown>;
  createdAt: string;
}

interface CachedResponse {
  key: string;
  userId: string;
  farmId: string;
  path: string;
  data: unknown;
  savedAt: string;
}

interface OfflineIdentity {
  user: {
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
  };
  farms: Array<{ id: string; name: string; logo_url: string | null }>;
  authenticatedAt: string;
}

const DB_NAME = 'finca-control-offline-v1';
const DB_VERSION = 1;
const AUTH_KEY = 'finca-control-offline-auth';
const VERIFIER_KEY = 'finca-control-offline-password-verifier';
const TOKEN_OWNER_KEY = 'finca-control-auth-owner';
const listeners = new Set<() => void>();
let database: Promise<IDBDatabase> | null = null;
let currentUserId: string | null = null;

export type OfflineStorageStatus = 'persistent' | 'best-effort' | 'unsupported';

export async function requestOfflineStoragePersistence(): Promise<OfflineStorageStatus> {
  const storage = navigator.storage;
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'persistent';
    return await storage.persist() ? 'persistent' : 'best-effort';
  } catch (error) {
    console.warn('El navegador no confirmó almacenamiento local persistente.', error);
    return 'best-effort';
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) return Promise.reject(new Error('El almacenamiento local seguro no está disponible.'));
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('responses')) db.createObjectStore('responses', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No se pudo abrir el almacenamiento offline.'));
  });
  return database;
}

function createTransaction(db: IDBDatabase, storeName: string, mode: IDBTransactionMode) {
  try {
    return db.transaction(storeName, mode, {
      durability: mode === 'readwrite' ? 'strict' : 'relaxed',
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return db.transaction(storeName, mode);
  }
}

function scope(userId: string, farmId: string | null, path: string) {
  return `${userId}|${farmId ?? 'account'}|${path}`;
}

function notify() {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent('finca-offline-change'));
}

export function notifyOfflineChange() {
  notify();
}

export function subscribeOffline(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setOfflineUser(userId: string | null) {
  currentUserId = userId;
  if (userId) localStorage.setItem(TOKEN_OWNER_KEY, userId);
}

export function getOfflineUserId() {
  return currentUserId;
}

function getOfflineIdentities(): Record<string, OfflineIdentity> {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const legacyUser = parsed.user as OfflineIdentity['user'] | undefined;
    if (legacyUser?.id) return { [legacyUser.id]: parsed as unknown as OfflineIdentity };
    return parsed as Record<string, OfflineIdentity>;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return {};
  }
}

export function getTokenOwnerId() {
  return localStorage.getItem(TOKEN_OWNER_KEY);
}

export function setOfflineSnapshotReady(userId: string, farmId: string, ready: boolean) {
  const key = `finca-control-offline-ready:${userId}:${farmId}`;
  if (ready) localStorage.setItem(key, new Date().toISOString());
  else localStorage.removeItem(key);
}

export function isOfflineSnapshotReady(userId: string, farmId: string) {
  return Boolean(localStorage.getItem(`finca-control-offline-ready:${userId}:${farmId}`));
}

export async function saveOfflineIdentity(identity: Omit<OfflineIdentity, 'authenticatedAt'>) {
  currentUserId = identity.user.id;
  const identities = getOfflineIdentities();
  identities[identity.user.id] = { ...identity, authenticatedAt: new Date().toISOString() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(identities));
  await cacheResponse('/api/auth/farms/', identity.farms, null, identity.user.id);
}

export function getOfflineIdentity(userId = currentUserId): OfflineIdentity | null {
  const identities = getOfflineIdentities();
  const value = userId ? identities[userId] : Object.values(identities).length === 1
    ? Object.values(identities)[0] : undefined;
  if (!value?.user?.profile?.id || !Array.isArray(value.farms)) return null;
  return value;
}

export function getOfflineIdentityByEmail(email: string): OfflineIdentity | null {
  const normalizedEmail = email.trim().toLowerCase();
  return Object.values(getOfflineIdentities()).find(
    (identity) => identity?.user?.email?.toLowerCase() === normalizedEmail,
  ) ?? null;
}

export async function saveOfflinePasswordVerifier(email: string, password: string) {
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) throw new Error('Este dispositivo no admite la verificación segura de inicio offline.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await cryptoApi.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await cryptoApi.deriveBits(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    material,
    256,
  );
  const entries = JSON.parse(localStorage.getItem(VERIFIER_KEY) ?? '{}') as Record<string, { salt: string; hash: string }>;
  entries[email.trim().toLowerCase()] = {
    salt: toBase64(salt),
    hash: toBase64(new Uint8Array(bits)),
  };
  localStorage.setItem(VERIFIER_KEY, JSON.stringify(entries));
}

export async function verifyOfflinePassword(email: string, password: string) {
  const identity = getOfflineIdentityByEmail(email);
  if (!identity) return null;
  const entries = JSON.parse(localStorage.getItem(VERIFIER_KEY) ?? '{}') as Record<string, { salt: string; hash: string }>;
  const verifier = entries[email.trim().toLowerCase()];
  if (!verifier || !globalThis.crypto?.subtle) return null;
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64(verifier.salt), iterations: 210000, hash: 'SHA-256' },
    material,
    256,
  );
  const actual = new Uint8Array(bits);
  const expected = fromBase64(verifier.hash);
  if (actual.length !== expected.length) return null;
  let difference = 0;
  actual.forEach((value, index) => { difference |= value ^ expected[index]; });
  return difference === 0 ? identity : null;
}

export async function cacheResponse(path: string, data: unknown, farmId: string | null, userId = currentUserId) {
  if (!userId || path.includes('/password/')) return;
  const db = await openDatabase();
  const item: CachedResponse = {
    key: scope(userId, farmId, path),
    userId,
    farmId: farmId ?? '',
    path,
    data,
    savedAt: new Date().toISOString(),
  };
  await transactionDone(db, 'responses', 'readwrite', (store) => store.put(item));
}

export async function replaceCachedResponses(
  entries: Array<{ path: string; data: unknown; farmId: string | null }>,
  userId = currentUserId,
) {
  if (!userId) throw new Error('Inicia sesión antes de guardar una copia offline.');
  const db = await openDatabase();
  const transaction = createTransaction(db, 'responses', 'readwrite');
  const transactionDoneResult = transactionDonePromise(transaction);
  const store = transaction.objectStore('responses');
  const request = store.getAll();
  request.onsuccess = () => {
    const resources = new Set(entries.map(({ path, farmId }) => {
      const prefix = /^\/api\/(?:auth\/)?[a-z-]+\//.exec(path)?.[0] ?? path;
      return `${farmId ?? ''}|${prefix}`;
    }));
    for (const item of request.result as CachedResponse[]) {
      const prefix = /^\/api\/(?:auth\/)?[a-z-]+\//.exec(item.path)?.[0] ?? item.path;
      if (item.userId === userId && resources.has(`${item.farmId}|${prefix}`)) {
        store.delete(item.key);
      }
    }
    const savedAt = new Date().toISOString();
    for (const { path, data, farmId } of entries) {
      store.put({
        key: scope(userId, farmId, path),
        userId,
        farmId: farmId ?? '',
        path,
        data,
        savedAt,
      } satisfies CachedResponse);
    }
  };
  request.onerror = () => transaction.abort();
  await transactionDoneResult;
  notify();
}

export async function readCachedResponse<T>(path: string, farmId: string | null): Promise<T | undefined> {
  if (!currentUserId) return undefined;
  const db = await openDatabase();
  const item = await requestResult<CachedResponse | undefined>(
    db.transaction('responses', 'readonly').objectStore('responses').get(scope(currentUserId, farmId, path)),
  );
  return item?.data as T | undefined;
}

export async function findCachedRecord(path: string, farmId: string | null, recordId: string) {
  if (!currentUserId) return null;
  const db = await openDatabase();
  const records = await requestResult<CachedResponse[]>(
    db.transaction('responses', 'readonly').objectStore('responses').getAll(),
  );
  const prefix = path.replace(/\/[^/]*$/, '/');
  for (const entry of records) {
    if (entry.userId !== currentUserId || entry.farmId !== (farmId ?? '') || !entry.path.startsWith(prefix)) continue;
    const values = Array.isArray(entry.data) ? entry.data : [entry.data];
    const match = values.find((value) => value && typeof value === 'object' && (value as { id?: unknown }).id === recordId);
    if (match) return match as Record<string, unknown>;
  }
  return null;
}

export async function queueOfflineOperation(operation: OfflineOperation) {
  const db = await openDatabase();
  await transactionDone(db, 'outbox', 'readwrite', (store) => store.put(operation));
  await updateCachedList(operation, true);
  notify();
}

export async function findQueuedOperation(userId: string, farmId: string, resource: string, recordId: string) {
  const db = await openDatabase();
  const items = await requestResult<OfflineOperation[]>(db.transaction('outbox', 'readonly').objectStore('outbox').getAll());
  return items.find((item) => {
    const itemResource = /^\/api\/([a-z-]+)\//.exec(item.path)?.[1];
    const itemId = item.path.match(/^\/api\/[a-z-]+\/([^/]+)\/$/)?.[1] ?? item.id;
    return item.userId === userId && item.farmId === farmId
      && (item.status === 'queued' || item.status === 'rejected')
      && itemResource === resource && itemId === recordId;
  }) ?? null;
}

async function updateCachedList(operation: OfflineOperation, queued: boolean) {
  const db = await openDatabase();
  const transaction = createTransaction(db, 'responses', 'readwrite');
  const store = transaction.objectStore('responses');
  const entries = await requestResult<CachedResponse[]>(store.getAll());
  const prefix = /^\/api\/[a-z-]+\//.exec(operation.path)?.[0] ?? operation.path;
  const recordId = operation.path.match(/^\/api\/[a-z-]+\/([^/]+)\/$/)?.[1]
    ?? (operation.method === 'POST' ? operation.body?.id as string | undefined : undefined)
    ?? operation.id;
  for (const entry of entries) {
    if (entry.userId !== operation.userId || entry.farmId !== operation.farmId || !entry.path.startsWith(prefix) || !Array.isArray(entry.data)) continue;
    if (entry.path !== prefix) {
      store.delete(entry.key);
      continue;
    }
    const rows = [...entry.data] as Array<Record<string, unknown>>;
    const index = rows.findIndex((row) => row.id === recordId);
    if (operation.method === 'DELETE') {
      if (index >= 0) rows.splice(index, 1);
    } else {
      const value: Record<string, unknown> = {
        ...(operation.baseState ?? {}),
        ...(operation.body ?? {}),
        id: recordId,
      };
      if (queued) {
        value.__offlineQueued = true;
        value.__offlineStatus = 'queued';
      } else {
        delete value.__offlineQueued;
        delete value.__offlineStatus;
      }
      if (index >= 0) rows[index] = value;
      else if (operation.method === 'POST') rows.unshift(value);
    }
    entry.data = rows;
    entry.savedAt = new Date().toISOString();
    store.put(entry);
  }
  await transactionDonePromise(transaction);
}

export async function applyServerResult(operation: OfflineOperation, data: Record<string, unknown> | null) {
  const updated: OfflineOperation = {
    ...operation,
    body: data,
    baseState: operation.baseState,
  };
  await updateCachedList(updated, false);
}

export async function updateCachedAccountList(
  path: string,
  method: string,
  recordId: string | undefined,
  data: unknown,
) {
  const userId = currentUserId;
  if (!userId) return;
  const db = await openDatabase();
  const key = scope(userId, null, path);
  const entry = await requestResult<CachedResponse | undefined>(
    db.transaction('responses', 'readonly').objectStore('responses').get(key),
  );
  if (!entry || !Array.isArray(entry.data)) return;
  let rows = [...entry.data] as Array<Record<string, unknown>>;
  if (method === 'DELETE' && recordId) {
    rows = rows.filter((row) => row.id !== recordId);
  } else if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : recordId;
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) rows[index] = record;
    else if (method === 'POST') rows.unshift(record);
  }
  await cacheResponse(path, rows, null, userId);
  if (path === '/api/auth/farms/') {
    const identities = getOfflineIdentities();
    const identity = identities[userId];
    if (identity) {
      identity.farms = rows as OfflineIdentity['farms'];
      localStorage.setItem(AUTH_KEY, JSON.stringify(identities));
    }
  }
}

export async function clearOfflineFarm(userId: string, farmId: string) {
  const db = await openDatabase();
  for (const storeName of ['responses', 'outbox']) {
    const tx = createTransaction(db, storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const records = await requestResult<Array<CachedResponse | OfflineOperation>>(store.getAll());
    records.forEach((record) => {
      if (record.userId === userId && record.farmId === farmId) store.delete(
        'key' in record ? record.key : record.id,
      );
    });
    await transactionDonePromise(tx);
  }
  localStorage.removeItem(`finca-control-offline-ready:${userId}:${farmId}`);
  if (currentUserId === userId && localStorage.getItem(`finca-control-active-farm:${userId}`) === farmId) {
    localStorage.removeItem(`finca-control-active-farm:${userId}`);
    if (localStorage.getItem('finca-control-active-farm') === farmId) localStorage.removeItem('finca-control-active-farm');
  }
  notify();
}

export async function getOfflineOperations(userId = currentUserId, farmId?: string | null) {
  if (!userId) return [];
  const db = await openDatabase();
  const items = await requestResult<OfflineOperation[]>(db.transaction('outbox', 'readonly').objectStore('outbox').getAll());
  return items.filter((item) => item.userId === userId && (farmId === undefined || item.farmId === (farmId ?? '')));
}

export async function updateOfflineOperation(operation: OfflineOperation) {
  const db = await openDatabase();
  await transactionDone(db, 'outbox', 'readwrite', (store) => store.put(operation));
  notify();
}

export async function removeOfflineOperation(id: string) {
  const db = await openDatabase();
  await transactionDone(db, 'outbox', 'readwrite', (store) => store.delete(id));
  notify();
}

export async function cancelQueuedOperation(id: string, deleteOperation: OfflineOperation) {
  const db = await openDatabase();
  await transactionDone(db, 'outbox', 'readwrite', (store) => store.delete(id));
  await updateCachedList(deleteOperation, false);
  notify();
}

export async function invalidateCachedResource(path: string, userId = currentUserId, farmId?: string | null) {
  if (!userId) return;
  const db = await openDatabase();
  const tx = createTransaction(db, 'responses', 'readwrite');
  const store = tx.objectStore('responses');
  const records = await requestResult<CachedResponse[]>(store.getAll());
  const prefix = /^\/api\/[a-z-]+\//.exec(path)?.[0] ?? path;
  records.forEach((item) => {
    if (item.userId === userId && (farmId === undefined || item.farmId === (farmId ?? '')) && item.path.startsWith(prefix)) store.delete(item.key);
  });
  await transactionDonePromise(tx);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No se pudo leer el almacenamiento offline.'));
  });
}

function transactionDone(db: IDBDatabase, storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  const tx = createTransaction(db, storeName, mode);
  action(tx.objectStore(storeName));
  return transactionDonePromise(tx);
}

function transactionDonePromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('No se pudo guardar el cambio offline.'));
    transaction.onabort = () => reject(new Error('El guardado offline fue cancelado.'));
  });
}

function toBase64(value: Uint8Array) {
  return btoa(Array.from(value, (byte) => String.fromCharCode(byte)).join(''));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
