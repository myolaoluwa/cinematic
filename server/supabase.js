import { ApiError } from './runtime.js';

function configuration() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !anonKey) throw new Error('Supabase environment variables are not configured.');
  return { url, key, anonKey };
}

async function request(path, init = {}, { publicKey = false, raw = false, authErrors = false } = {}) {
  const { url, key, anonKey } = configuration();
  const headers = new Headers(init.headers || {});
  headers.set('apikey', publicKey ? anonKey : key);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${publicKey ? anonKey : key}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    if (authErrors && (response.status === 400 || response.status === 401)) {
      throw new ApiError(401, 'That email or password was not recognized.');
    }
    if (raw && response.status === 404) return null;
    if (path.includes('/rpc/update_client_selection')) {
      if (detail.includes('selection_limit_reached')) throw new ApiError(409, 'You have reached the photo selection limit.');
      if (detail.includes('selection_locked')) throw new ApiError(409, 'Your photo choices have been submitted and are locked.');
      if (detail.includes('collection_unavailable')) throw new ApiError(410, 'This collection is no longer available.');
      if (detail.includes('photo_unavailable')) throw new ApiError(404, 'That proof photo is no longer available.');
    }
    if (path.includes('/rpc/submit_client_selections')) {
      if (detail.includes('no_selections')) throw new ApiError(409, 'Choose at least one photo before sending your choices.');
      if (detail.includes('selection_locked')) throw new ApiError(409, 'Your photo choices have already been submitted.');
      if (detail.includes('collection_unavailable')) throw new ApiError(410, 'This collection is no longer available.');
    }
    if (path.includes('/rpc/publish_client_collection')) {
      if (detail.includes('proofs_required')) throw new ApiError(409, 'Add at least one finished proof photo before publishing.');
      if (detail.includes('collection_unavailable')) throw new ApiError(404, 'That collection could not be found.');
    }
    if (path.includes('/rpc/set_collection_selection_limit')) {
      if (detail.includes('selection_limit_below_current')) throw new ApiError(409, 'The cap cannot be lower than the client’s current selections.');
      if (detail.includes('collection_unavailable')) throw new ApiError(404, 'That collection could not be found.');
    }
    if (path.includes('/rpc/reopen_client_selections') && detail.includes('collection_unavailable')) {
      throw new ApiError(404, 'That collection could not be found.');
    }
    if (path.includes('/rpc/mark_collection_photo_deleting') && detail.includes('photo_unavailable')) {
      throw new ApiError(404, 'That photo could not be found.');
    }
    console.error('Supabase request failed:', response.status, path, detail);
    throw new ApiError(502, 'The private gallery service is temporarily unavailable.');
  }
  if (raw) return response;
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function supabaseUrl() {
  return configuration().url;
}

export function anonKey() {
  return configuration().anonKey;
}

export async function authRequest(path, body) {
  return request(`/auth/v1/${path}`, { method: 'POST', body: JSON.stringify(body) }, { publicKey: true, authErrors: true });
}

export async function authUser(accessToken) {
  const { url, anonKey: key } = configuration();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return null;
    const detail = (await response.text()).slice(0, 1000);
    console.error('Supabase user verification failed:', response.status, detail);
    throw new ApiError(502, 'The private gallery service is temporarily unavailable.');
  }
  return response.json();
}

export async function dbSelect(table, params, select = '*') {
  const query = new URLSearchParams({ select, ...params });
  return request(`/rest/v1/${table}?${query}`);
}

export async function dbInsert(table, value, select = '*') {
  const query = new URLSearchParams({ select });
  return request(`/rest/v1/${table}?${query}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(value),
  });
}

export async function dbUpdate(table, params, value, select = '*') {
  const query = new URLSearchParams({ ...params, select });
  return request(`/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(value),
  });
}

export async function dbDelete(table, params) {
  const query = new URLSearchParams(params);
  return request(`/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

export async function dbRpc(name, value) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(value) });
}

export async function signedUpload(bucket, objectPath) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  const result = await request(`/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encoded}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const path = result.signedURL || result.url;
  if (!path) throw new ApiError(502, 'The secure upload could not be prepared.');
  const uploadUrl = path.startsWith('http') ? path : `${supabaseUrl()}/storage/v1${path.startsWith('/') ? path : `/${path}`}`;
  return { uploadUrl, apiKey: anonKey() };
}

export async function signedDownload(bucket, objectPath, expiresIn = 300, downloadName = null) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  const result = await request(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encoded}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn, download: downloadName || false }),
  });
  const path = result.signedURL || result.signedUrl;
  if (!path) throw new ApiError(502, 'A private photo could not be prepared.');
  return path.startsWith('http') ? path : `${supabaseUrl()}/storage/v1${path.startsWith('/') ? path : `/${path}`}`;
}

export async function removeObjects(bucket, objectPaths) {
  if (!objectPaths.length) return;
  const encodedBucket = encodeURIComponent(bucket);
  for (let index = 0; index < objectPaths.length; index += 100) {
    const response = await request(`/storage/v1/object/${encodedBucket}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: objectPaths.slice(index, index + 100) }),
    }, { raw: true });
    void response;
  }
}

export async function objectExists(bucket, objectPath) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  const response = await request(`/storage/v1/object/info/${encodeURIComponent(bucket)}/${encoded}`, {}, { raw: true });
  return Boolean(response?.ok);
}

export function storageBucket() {
  return 'client-galleries';
}
