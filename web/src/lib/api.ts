export type ConfigResponse = {
  endpoint: string;
  projectId: string;
  databaseId: string;
  tableId: string;
};

export type UserResponse = {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
  sessionSecret: string;
};

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  config: () => jsonFetch<ConfigResponse>('/api/config'),
  seed: () => jsonFetch<{ ok: boolean; summary: unknown; log: string[] }>('/api/seed', { method: 'POST' }),
  ping: () => jsonFetch<{ ok: boolean }>('/api/appwrite-ping'),
  createUser: (name?: string) =>
    jsonFetch<UserResponse>('/api/users', { method: 'POST', body: JSON.stringify({ name }) }),
  rehydrateUsers: () =>
    jsonFetch<{ total: number; users: UserResponse[] }>('/api/users/rehydrate', { method: 'POST' }),
  deleteUser: (userId: string) =>
    jsonFetch<{ ok: boolean }>(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  purgeUsers: () => jsonFetch<{ ok: boolean; removed: number }>('/api/users/purge', { method: 'POST' }),
  createRow: (row: { name?: string; priority?: 'low' | 'medium' | 'high'; userId?: string; message?: string; rowId?: string }) =>
    jsonFetch<{ ok: boolean; row: { $id: string } }>('/api/rows', { method: 'POST', body: JSON.stringify(row) }),
  bulkRows: (count: number, template?: object) =>
    jsonFetch<{ ok: boolean; count: number; ms: number }>('/api/rows/bulk', {
      method: 'POST',
      body: JSON.stringify({ count, template }),
    }),
  patchRow: (rowId: string, data: object) =>
    jsonFetch<{ ok: boolean }>(`/api/rows/${encodeURIComponent(rowId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteRow: (rowId: string) =>
    jsonFetch<{ ok: boolean }>(`/api/rows/${encodeURIComponent(rowId)}`, { method: 'DELETE' }),
  resetRows: () => jsonFetch<{ ok: boolean; removed: number }>('/api/rows/reset', { method: 'POST' }),
  listRows: () => jsonFetch<{ total: number; rows: Array<{ $id: string; [k: string]: any }> }>('/api/rows'),
};
