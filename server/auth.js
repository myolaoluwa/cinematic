import { ApiError, clearCookie, cookieValue, openSession, sealSession, setCookie } from './runtime.js';
import { authRequest, authUser, dbSelect } from './supabase.js';

const OWNER_COOKIE = 'evayoung_owner';
const CLIENT_COOKIE = 'evayoung_client';
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function ownerId() {
  const id = process.env.OWNER_USER_ID;
  if (!id) throw new Error('OWNER_USER_ID is not configured.');
  return id;
}

function setOwnerCookie(res, value) {
  setCookie(res, OWNER_COOKIE, value, '/api/owner', THIRTY_DAYS);
}

export async function startOwnerSession(req, res, email, password) {
  const result = await authRequest('token?grant_type=password', { email, password });
  const user = result?.user;
  if (!user || user.id !== ownerId()) {
    clearCookie(res, OWNER_COOKIE, '/api/owner');
    throw new ApiError(403, 'This account does not have workspace access.');
  }
  const session = {
    kind: 'owner',
    userId: user.id,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    accessExpiresAt: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600),
    exp: Date.now() + THIRTY_DAYS * 1000,
  };
  setOwnerCookie(res, sealSession(session));
}

export async function requireOwner(req, res) {
  let session = openSession(cookieValue(req, OWNER_COOKIE), 'owner');
  if (!session || session.userId !== ownerId() || !session.refreshToken) {
    clearCookie(res, OWNER_COOKIE, '/api/owner');
    throw new ApiError(401, 'Please sign in to the workspace.');
  }

  if (session.accessExpiresAt <= Math.floor(Date.now() / 1000) + 60) {
    try {
      const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refreshToken });
      if (!refreshed?.access_token || refreshed.user?.id !== ownerId()) {
        throw new ApiError(401, 'Your sign-in has expired. Please sign in again.');
      }
      session = {
        ...session,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        accessExpiresAt: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600),
        exp: Date.now() + THIRTY_DAYS * 1000,
      };
      setOwnerCookie(res, sealSession(session));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      clearCookie(res, OWNER_COOKIE, '/api/owner');
      throw new ApiError(401, 'Your sign-in has expired. Please sign in again.');
    }
  }

  const user = await authUser(session.accessToken);
  if (!user || user.id !== ownerId()) {
    clearCookie(res, OWNER_COOKIE, '/api/owner');
    throw new ApiError(401, 'Please sign in to the workspace.');
  }
  return { id: user.id, email: user.email };
}

export function endOwnerSession(res) {
  clearCookie(res, OWNER_COOKIE, '/api/owner');
}

export async function requireClient(req, res, expectedShareHash = null) {
  const session = openSession(cookieValue(req, CLIENT_COOKIE), 'client');
  if (!session || typeof session.collectionId !== 'string') {
    clearCookie(res, CLIENT_COOKIE, '/api/client');
    throw new ApiError(401, 'Enter the collection password to continue.');
  }
  if (expectedShareHash && session.shareHash !== expectedShareHash) {
    clearCookie(res, CLIENT_COOKIE, '/api/client');
    throw new ApiError(401, 'Enter the collection password to continue.');
  }
  const rows = await dbSelect('collections', {
    id: `eq.${session.collectionId}`,
    status: 'eq.published',
    select: 'id,title,client_name,selection_limit,status,access_expires_at,selection_submitted_at,share_token_hash',
  });
  const collection = rows[0];
  if (!collection || !collection.access_expires_at || Date.parse(collection.access_expires_at) <= Date.now()) {
    clearCookie(res, CLIENT_COOKIE, '/api/client');
    throw new ApiError(410, 'This collection is no longer available. Contact Evayoung Photography if you need access.');
  }
  if (session.shareHash !== collection.share_token_hash) {
    clearCookie(res, CLIENT_COOKIE, '/api/client');
    throw new ApiError(401, 'Enter the collection password to continue.');
  }
  if (expectedShareHash && collection.share_token_hash !== expectedShareHash) {
    clearCookie(res, CLIENT_COOKIE, '/api/client');
    throw new ApiError(401, 'Enter the collection password to continue.');
  }
  const renewed = {
    kind: 'client',
    collectionId: collection.id,
    shareHash: collection.share_token_hash,
    exp: Date.now() + THIRTY_DAYS * 1000,
  };
  setCookie(res, CLIENT_COOKIE, sealSession(renewed), '/api/client', THIRTY_DAYS);
  return collection;
}

export function startClientSession(res, collectionId, shareHash) {
  const session = { kind: 'client', collectionId, shareHash, exp: Date.now() + THIRTY_DAYS * 1000 };
  setCookie(res, CLIENT_COOKIE, sealSession(session), '/api/client', THIRTY_DAYS);
}
