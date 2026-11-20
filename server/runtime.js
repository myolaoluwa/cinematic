import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function withErrors(handler) {
  return async function apiHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof ApiError) {
        return send(res, error.status, { error: error.message });
      }
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        console.error('Workspace API request timed out:', error);
        return send(res, 503, { error: 'The gallery service took too long to respond. Please try again.' });
      }
      console.error('Workspace API error:', error);
      return send(res, 500, { error: 'Something went wrong. Please try again.' });
    }
  };
}

export function send(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

export function requireMethod(req, ...methods) {
  if (!methods.includes(req.method)) {
    throw new ApiError(405, 'This action is not available.');
  }
}

export function assertSameOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.origin;
  if (!origin || origin === 'null') {
    throw new ApiError(403, 'This request could not be verified.');
  }

  let requestOrigin;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    throw new ApiError(403, 'This request could not be verified.');
  }

  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto']?.split(',')[0].trim()
    || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const expectedOrigin = configuredOrigin || (host ? `${protocol}://${host}` : '');
  if (!expectedOrigin || requestOrigin !== new URL(expectedOrigin).origin) {
    throw new ApiError(403, 'This request could not be verified.');
  }
}

export function requestOrigin(req) {
  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  if (configuredOrigin) return new URL(configuredOrigin).origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto']?.split(',')[0].trim()
    || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  if (!host) throw new Error('The request host is unavailable.');
  return new URL(`${protocol}://${host}`).origin;
}

export function readJson(req, maxBytes = 65536) {
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    if (Buffer.byteLength(JSON.stringify(body)) > maxBytes) {
      throw new ApiError(413, 'The request is too large.');
    }
    return body;
  }
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
  if (Buffer.byteLength(text) > maxBytes) throw new ApiError(413, 'The request is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Please send a valid request.');
  }
}

export function requireText(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ApiError(400, `Enter a ${label} (up to ${max} characters).`);
  }
  return value.trim();
}

export function optionalText(value, label, max = 120) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ApiError(400, `Keep ${label} under ${max} characters.`);
  }
  return value.trim() || null;
}

export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function requireUuid(value, label = 'collection') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, `Choose a valid ${label}.`);
  }
  return value;
}

export function requireSelectionLimit(value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'Set a selection limit between 1 and 100.');
  }
  return limit;
}

export function cookieValue(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return '';
      }
    }
  }
  return '';
}

function sessionSecret() {
  const secret = process.env.WORKSPACE_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('WORKSPACE_SESSION_SECRET must contain at least 32 bytes.');
  }
  return secret;
}

export function sealSession(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function openSession(value, kind) {
  if (!value || value.length > 10000) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.kind !== kind || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function setCookie(res, name, value, path, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge))}${secure}`);
}

export function clearCookie(res, name, path) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

export function newClientPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 16 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export function hashPassword(password, salt = randomBytes(32).toString('base64url')) {
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64url');
  return { salt, hash };
}

export function passwordMatches(password, salt, expectedHash) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 256) return false;
  try {
    const actual = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const expected = Buffer.from(expectedHash, 'base64url');
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function ipHash(req) {
  const address = req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
  return createHmac('sha256', sessionSecret()).update(address).digest('hex');
}

export function newShareToken() {
  return randomBytes(32).toString('base64url');
}

export function safeCollection(collection) {
  const {
    id, title, client_name: clientName, shoot_date: shootDate, selection_limit: selectionLimit,
    status, created_at: createdAt, published_at: publishedAt, access_expires_at: accessExpiresAt,
    selection_submitted_at: selectionSubmittedAt,
  } = collection;
  return { id, title, clientName, shootDate, selectionLimit, status, createdAt, publishedAt, accessExpiresAt, selectionSubmittedAt };
}
